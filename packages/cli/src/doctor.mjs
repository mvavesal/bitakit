import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describeFoundation } from '@bitakit/core/discovery';
import { exists, findProject } from './project.mjs';
import { appRoutes, catchAllRoute } from './routes.mjs';

/**
 * Checks a project for the problems that most often break a BitaKit app: mixed package
 * versions, duplicate Core copies, unreachable plugin pages and links, colliding service
 * names and missing styles. Each result: `{ status: 'ok' | 'warn' | 'error', title, details, fix }`.
 */
export async function doctor({ cwd } = {}) {
  const project = await findProject(cwd);
  const results = [await checkVersions(project), await checkCopies(project)];
  if (project.kind === 'plugin') {
    results.push(checkPluginPackage(project));
    return { project, results };
  }
  let description;
  try {
    description = await describeFoundation(project.root);
  } catch (error) {
    results.push({ status: 'error', title: 'Discovery failed', details: [error.message] });
    return { project, results };
  }
  const modules = [description.app, ...description.plugins.filter((plugin) => plugin.enabled)];
  const scanned = await Promise.all(
    modules.map(async (module) => ({
      module,
      pages: await literals(project.root, module.pages, ['definePage'], 'path'),
      links: await literals(project.root, module.actions, ['defineURLAction'], 'href'),
      names: await serviceNames(project.root, module),
    })),
  );
  const routes = await appRoutes(project);
  const shell = '@bitakit/shell' in { ...project.manifest.dependencies };
  results.push(checkPages(project, scanned, routes, { shell, group: await shellGroup(project) }));
  results.push(checkLinks(scanned, routes));
  results.push(checkServiceNames(scanned));
  results.push(await checkStyles(project, description));
  return { project, results };
}

/** Installed @bitakit packages as Node resolves them: nearest node_modules first, then parents. */
async function installedPackages(root) {
  const packages = new Map();
  for (let directory = root; ; directory = path.dirname(directory)) {
    const scope = path.join(directory, 'node_modules/@bitakit');
    for (const name of await readdir(scope).catch(() => [])) {
      if (packages.has(name)) continue;
      const manifest = await readFile(path.join(scope, name, 'package.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => undefined);
      if (manifest?.version)
        packages.set(name, { name: manifest.name ?? `@bitakit/${name}`, version: manifest.version });
    }
    if (path.dirname(directory) === directory) return [...packages.values()];
  }
}

/** The npm workspace root that installs this project's packages, or the project itself. */
async function installRoot(root) {
  for (let directory = path.dirname(root); path.dirname(directory) !== directory; directory = path.dirname(directory)) {
    const manifest = await readFile(path.join(directory, 'package.json'), 'utf8').then(JSON.parse, () => undefined);
    if (manifest?.workspaces) return directory;
  }
  return root;
}

async function checkVersions(project) {
  const packages = (await installedPackages(project.root)).filter(
    (item) => item.name !== '@bitakit/create-app',
  );
  if (!packages.length)
    return { status: 'warn', title: 'No @bitakit packages installed', fix: 'Run npm install.' };
  const versions = [...new Set(packages.map((item) => item.version))];
  if (versions.length === 1)
    return { status: 'ok', title: `All ${packages.length} @bitakit packages are ${versions[0]}` };
  return {
    status: 'error',
    title: 'Mixed @bitakit versions',
    details: packages.map((item) => `${item.name}@${item.version}`),
    fix: `Install one release for all of them: npm install ${packages.map((item) => `${item.name}@latest`).join(' ')}`,
  };
}

/** Linked plugins with their own node_modules load a second copy of Core. */
async function checkCopies(project) {
  const copies = new Set();
  const visit = async (directory, depth) => {
    if (depth > 6) return;
    const core = path.join(directory, 'node_modules/@bitakit/core');
    if (await exists(path.join(core, 'package.json'))) copies.add(await realpath(core));
    const entries = await readdir(path.join(directory, 'node_modules'), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const children = entry.name.startsWith('@')
        ? (await readdir(path.join(directory, 'node_modules', entry.name)).catch(() => [])).map((name) =>
            path.join(directory, 'node_modules', entry.name, name),
          )
        : [path.join(directory, 'node_modules', entry.name)];
      for (const child of children) {
        const real = await realpath(child).catch(() => child);
        // Follow links (npm link, file:, workspaces) outside node_modules into their own trees.
        if (!real.split(path.sep).includes('node_modules')) await visit(real, depth + 1);
        else if (depth < 2) await visit(child, depth + 1);
      }
    }
  };
  await visit(await installRoot(project.root), 0);
  if (copies.size <= 1)
    return { status: 'ok', title: copies.size ? 'One copy of @bitakit/core' : 'Core is not installed yet' };
  return {
    status: 'error',
    title: `${copies.size} copies of @bitakit/core are installed`,
    details: [...copies].map((copy) => path.relative(project.root, copy) || copy),
    fix: 'Plugins must list @bitakit/core as a peerDependency. For a linked plugin, delete its own node_modules/@bitakit/core or install it from a packed tarball (npm pack).',
  };
}

function checkPluginPackage(project) {
  const manifest = project.manifest;
  const problems = [];
  if (!manifest.exports?.['./package.json'])
    problems.push('Export "./package.json" so apps can read the foundation metadata.');
  if (!manifest.exports?.['./foundation']) problems.push('Export "./foundation" (the plugin entry).');
  if (manifest.dependencies?.['@bitakit/core'])
    problems.push('Move @bitakit/core from dependencies to peerDependencies to avoid a second copy.');
  if (!manifest.peerDependencies?.['@bitakit/core']) problems.push('Add @bitakit/core to peerDependencies.');
  return problems.length
    ? { status: 'error', title: 'Plugin package manifest needs changes', details: problems }
    : { status: 'ok', title: `Plugin package "${project.pluginId}" is ready to publish` };
}

/** String literal values of `property` in calls such as `definePage({ path: '/x' })`. */
async function literals(root, entries, callees, property) {
  const found = [];
  for (const entry of entries) {
    const source = await readFile(path.join(root, entry.file), 'utf8').catch(() => undefined);
    if (!source) continue;
    const file = ts.createSourceFile(entry.file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        callees.includes(node.expression.text) &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      )
        for (const item of node.arguments[0].properties)
          if (
            ts.isPropertyAssignment(item) &&
            item.name.getText(file) === property &&
            ts.isStringLiteralLike(item.initializer)
          )
            found.push({ value: item.initializer.text, file: entry.file });
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

async function serviceNames(root, module) {
  const names = [];
  for (const entry of module.services) {
    const [exposed] = await literals(root, [entry], ['defineService', 'provideService'], 'exposeAs');
    const [id] = exposed ? [] : await literals(root, [entry], ['defineService'], 'id');
    names.push({ name: exposed?.value ?? id?.value ?? entry.path, file: entry.file });
  }
  return names;
}

const label = (module) => (module.id === '@foundation/app' ? 'the app' : `plugin "${module.id}"`);
const match = (routes, href) => routes.filter((route) => route.pattern.test(href));

/** The Next route group whose layout renders AppShell, so plugin pages get the app frame. */
async function shellGroup(project) {
  if (project.framework !== 'next') return undefined;
  const app = path.join(project.root, 'src/app');
  for (const entry of await readdir(app, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || !/^\(.+\)$/.test(entry.name)) continue;
    const layout = await readFile(path.join(app, entry.name, 'layout.tsx'), 'utf8').catch(() => '');
    if (layout.includes('AppShell')) return entry.name;
  }
  return undefined;
}

function checkPages(project, scanned, routes, options) {
  const problems = [];
  let fix;
  for (const { module, pages } of scanned)
    for (const page of pages) {
      const matching = match(routes, page.value);
      const owner = matching.find((route) => !route.catchAll);
      if (owner)
        problems.push(`${label(module)} has a page at ${page.value}, but the app route ${owner.file} takes precedence.`);
      else if (!matching.length) {
        problems.push(`${label(module)} has a page at ${page.value} (${page.file}), but no route renders plugin pages.`);
        const route = catchAllRoute(project, options);
        fix = `Create ${route.file}:\n\n${route.content}`;
      }
    }
  const count = scanned.reduce((total, item) => total + item.pages.length, 0);
  return problems.length
    ? { status: 'error', title: 'Some plugin pages cannot be reached', details: problems, fix }
    : {
        status: 'ok',
        title: !count
          ? 'No plugin pages'
          : count === 1
            ? 'The plugin page can be reached'
            : `All ${count} plugin pages can be reached`,
      };
}

function checkLinks(scanned, routes) {
  const pages = new Set(scanned.flatMap((item) => item.pages.map((page) => page.value)));
  const problems = [];
  let count = 0;
  for (const { module, links } of scanned)
    for (const link of links) {
      if (!link.value.startsWith('/') || link.value.startsWith('//')) continue;
      count++;
      const href = link.value.replace(/[?#].*$/, '') || '/';
      if (pages.has(href)) continue;
      if (match(routes, href).some((route) => !route.catchAll)) continue;
      problems.push(`${label(module)} links to ${href} (${link.file}), but no page or route exists there.`);
    }
  return problems.length
    ? {
        status: 'warn',
        title: 'Some navigation links lead nowhere',
        details: problems,
        fix: 'Add a plugin page with definePage({ path }) or an app route for these paths.',
      }
    : {
        status: 'ok',
        title: !count
          ? 'No navigation links'
          : count === 1
            ? 'The navigation link has a page'
            : `All ${count} navigation links have a page`,
      };
}

function checkServiceNames(scanned) {
  const owners = new Map();
  const problems = [];
  for (const { module, names } of scanned)
    for (const { name, file } of names) {
      const existing = owners.get(name);
      if (existing && existing.module !== module)
        problems.push(
          `${label(existing.module)} (${existing.file}) and ${label(module)} (${file}) both expose a service named "${name}".`,
        );
      else owners.set(name, { module, file });
    }
  return problems.length
    ? {
        status: 'error',
        title: 'Service names collide',
        details: problems,
        fix: "Rename one service file, or set exposeAs (for example exposeAs: 'notes.store').",
      }
    : { status: 'ok', title: 'Service names are unique' };
}

async function checkStyles(project, description) {
  if (!description.styles.length) return { status: 'ok', title: 'No package styles to import' };
  const candidates = ['src/app/globals.css', 'app/globals.css', 'src/styles.css', 'src/index.css'];
  for (const file of candidates) {
    const css = await readFile(path.join(project.root, file), 'utf8').catch(() => '');
    if (css.includes('.foundation/styles.css'))
      return { status: 'ok', title: `Package styles are imported in ${file}` };
    if (css && description.styles.every((specifier) => css.includes(specifier)))
      return { status: 'ok', title: `Package styles are imported individually in ${file}` };
  }
  const target = project.framework === 'tanstack' ? 'src/styles.css' : 'src/app/globals.css';
  const relative = path.relative(path.dirname(path.join(project.root, target)), path.join(project.root, '.foundation/styles.css'));
  return {
    status: 'warn',
    title: 'Installed packages ship styles that are not imported',
    details: description.styles,
    fix: `Add this line after @import 'tailwindcss'; in ${target}:\n\n@import '${relative.split(path.sep).join('/')}';`,
  };
}
