import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describeFoundation } from '@bitakit/core/discovery';
import { exists, findProject } from './project.mjs';
import { appRoutes, catchAllRoute } from './routes.mjs';

/**
 * Checks a project for the problems that most often break a BitaKit app: mixed package
 * versions, duplicate Core copies, missing wiring, unreachable plugin pages and links,
 * colliding service aliases, missing styles and deprecated layouts.
 * Each result: `{ status: 'ok' | 'warn' | 'error', title, details, fix }`.
 */
export async function doctor({ cwd } = {}) {
  const project = await findProject(cwd);
  const results = [await checkVersions(project), await checkCopies(project)];
  if (project.kind === 'plugin') {
    results.push(checkPluginPackage(project));
    return { project, results };
  }
  if (project.configError) {
    results.push({
      status: 'error',
      title: `${path.basename(project.configFile)} could not be loaded`,
      details: [project.configError.message],
      fix: project.legacyConfig
        ? 'Run "npx bitakit migrate": it rewrites foundation.config.ts to bitakit.config.ts with defineBitaKit from @bitakit/core/discovery.'
        : 'Fix the error above; discovery reads this file to find your plugins.',
    });
    return { project, results };
  }
  let description;
  try {
    description = await describeFoundation(project.root);
  } catch (error) {
    results.push({ status: 'error', title: 'Discovery failed', details: [error.message] });
    return { project, results };
  }
  results.push(...(await checkWiring(project)));
  const modules = [
    { ...description.app, isApp: true },
    ...description.plugins.filter((plugin) => plugin.enabled),
  ];
  const scanned = await Promise.all(
    modules.map(async (module) => ({
      module,
      pages: await pagePaths(project.root, module),
      links: await literals(
        project.root,
        module.actions,
        ['defineAction', 'defineURLAction'],
        'href',
      ),
      aliases: await literals(
        project.root,
        module.services,
        ['defineService', 'provideService'],
        'exposeAs',
      ),
    })),
  );
  const routes = await appRoutes(project);
  const shell = '@bitakit/shell' in { ...project.manifest.dependencies };
  results.push(checkPages(project, scanned, routes, { shell, group: await shellGroup(project) }));
  results.push(checkLinks(scanned, routes));
  results.push(checkAliases(scanned));
  results.push(await checkStyles(project, description));
  results.push(checkIgnored(description), checkDeprecated(description), checkSlots(description));
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
        packages.set(name, {
          name: manifest.name ?? `@bitakit/${name}`,
          version: manifest.version,
        });
    }
    if (path.dirname(directory) === directory) return [...packages.values()];
  }
}
async function installRoot(root) {
  for (
    let directory = path.dirname(root);
    path.dirname(directory) !== directory;
    directory = path.dirname(directory)
  ) {
    const manifest = await readFile(path.join(directory, 'package.json'), 'utf8').then(
      JSON.parse,
      () => undefined,
    );
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
    const entries = await readdir(path.join(directory, 'node_modules'), {
      withFileTypes: true,
    }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const children = entry.name.startsWith('@')
        ? (await readdir(path.join(directory, 'node_modules', entry.name)).catch(() => [])).map(
            (name) => path.join(directory, 'node_modules', entry.name, name),
          )
        : [path.join(directory, 'node_modules', entry.name)];
      for (const child of children) {
        const real = await realpath(child).catch(() => child);
        if (!real.split(path.sep).includes('node_modules')) await visit(real, depth + 1);
        else if (depth < 2) await visit(child, depth + 1);
      }
    }
  };
  await visit(await installRoot(project.root), 0);
  if (copies.size <= 1)
    return {
      status: 'ok',
      title: copies.size ? 'One copy of @bitakit/core' : 'Core is not installed yet',
    };
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
    problems.push('Export "./package.json" so apps can read the bitakit metadata.');
  const entry = project.metadata?.plugin;
  if (!entry || !manifest.exports?.[entry])
    problems.push(`Export ${entry ?? '"./plugin"'} (the plugin entry named in bitakit.plugin).`);
  if (manifest.dependencies?.['@bitakit/core'])
    problems.push(
      'Move @bitakit/core from dependencies to peerDependencies to avoid a second copy.',
    );
  if (!manifest.peerDependencies?.['@bitakit/core'])
    problems.push('Add @bitakit/core to peerDependencies.');
  if (manifest.foundation && !manifest.bitakit)
    problems.push('Rename the "foundation" field in package.json to "bitakit".');
  return problems.length
    ? { status: 'error', title: 'Plugin package manifest needs changes', details: problems }
    : { status: 'ok', title: `Plugin package "${project.pluginId}" is ready to publish` };
}

/** Config wrapper, provider and ignore rules. */
async function checkWiring(project) {
  const results = [];
  const read = (file) => readFile(path.join(project.root, file), 'utf8').catch(() => '');
  if (project.framework === 'next') {
    const config =
      (await read('next.config.ts')) ||
      (await read('next.config.mjs')) ||
      (await read('next.config.js'));
    results.push(
      /withBitaKit|withFoundation/.test(config)
        ? { status: 'ok', title: 'next.config wraps the configuration with withBitaKit' }
        : {
            status: 'error',
            title: 'next.config does not run BitaKit discovery',
            fix: "import { withBitaKit } from '@bitakit/next/config';\nexport default withBitaKit({});",
          },
    );
    const scripts = JSON.stringify(project.manifest.scripts ?? {});
    if (scripts.includes('--webpack'))
      results.push({
        status: 'warn',
        title: 'Scripts still force Webpack',
        fix: 'Remove --webpack from the dev and build scripts; the generated file needs no bundler alias.',
      });
    if (scripts.includes('foundation-generate'))
      results.push({
        status: 'warn',
        title: 'Scripts use the old foundation-generate command',
        fix: 'Replace foundation-generate with "bitakit generate".',
      });
  }
  if (project.framework === 'tanstack') {
    const config = await read('vite.config.ts');
    results.push(
      /bitakit\(|foundation\(/.test(config)
        ? { status: 'ok', title: 'vite.config runs the BitaKit plugin' }
        : {
            status: 'error',
            title: 'vite.config does not run BitaKit discovery',
            fix: "import { bitakit } from '@bitakit/tanstack/config';\nplugins: [bitakit(), tanstackStart(), ...]",
          },
    );
  }
  const layouts =
    project.framework === 'tanstack'
      ? ['src/routes/__root.tsx']
      : ['src/app/layout.tsx', 'app/layout.tsx'];
  let provider = false;
  for (const file of layouts)
    if (/bitakit\.gen|BitaKitProvider|FoundationProvider/.test(await read(file))) provider = true;
  results.push(
    provider
      ? { status: 'ok', title: 'The root layout mounts the BitaKit provider' }
      : {
          status: 'error',
          title: 'No BitaKit provider in the root layout',
          fix: "import { BitaKitProvider } from '@/bitakit.gen';\n<BitaKitProvider>{children}</BitaKitProvider>",
        },
  );
  const ignore = await read('.gitignore');
  if (!ignore.includes('bitakit.gen'))
    results.push({
      status: 'warn',
      title: 'Generated files are not ignored by Git',
      fix: 'Add "src/bitakit.gen.*" to .gitignore.',
    });
  if (project.legacyConfig)
    results.push({
      status: 'warn',
      title: 'foundation.config.ts is deprecated',
      fix: 'Rename it to bitakit.config.ts and use defineBitaKit (npx bitakit migrate).',
    });
  return results;
}

/** String literal values of `property` in calls such as `defineAction({ href: '/x' })`. */
async function literals(root, entries, callees, property) {
  const found = [];
  for (const entry of entries) {
    const source = await readFile(path.join(root, entry.file), 'utf8').catch(() => undefined);
    if (!source) continue;
    const file = ts.createSourceFile(entry.file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      // Options may follow a factory argument: defineService(() => ..., { exposeAs: 'items' }).
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        callees.includes(node.expression.text)
      )
        for (const argument of node.arguments.filter(ts.isObjectLiteralExpression))
          for (const item of argument.properties)
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
/** Page paths: derived from `ui/pages` file names, or the `definePage({ path })` literal of a legacy page. */
async function pagePaths(root, module) {
  const pages = [];
  for (const entry of module.pages) {
    const derived =
      `${module.isApp ? '' : `/${module.id}`}${entry.path ? `/${entry.path.split('.').join('/')}` : ''}` ||
      '/';
    // A legacy definePage({ path }) export keeps its own path wherever the file lives.
    const [literal] = await literals(root, [entry], ['definePage'], 'path');
    pages.push({ value: literal?.value ?? derived, file: entry.file });
  }
  return pages;
}
const label = (module) => (module.isApp ? 'the app' : `plugin "${module.id}"`);
const match = (routes, href) =>
  routes.filter((route) => route.pattern.test(href.replace(/\[[^\]]+\]/g, 'x')));

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
        problems.push(
          `${label(module)} has a page at ${page.value}, but the app route ${owner.file} takes precedence.`,
        );
      else if (!matching.length) {
        problems.push(
          `${label(module)} has a page at ${page.value} (${page.file}), but no route renders plugin pages.`,
        );
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
      problems.push(
        `${label(module)} links to ${href} (${link.file}), but no page or route exists there.`,
      );
    }
  return problems.length
    ? {
        status: 'warn',
        title: 'Some navigation links lead nowhere',
        details: problems,
        fix: 'Add a page under ui/pages or an app route for these paths.',
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
/** Service IDs are namespaced per plugin; only `exposeAs` aliases can collide. */
function checkAliases(scanned) {
  const owners = new Map();
  const problems = [];
  for (const { module, aliases } of scanned)
    for (const { value, file } of aliases) {
      const existing = owners.get(value);
      if (existing && existing.module !== module)
        problems.push(
          `${label(existing.module)} (${existing.file}) and ${label(module)} (${file}) both expose a service as "${value}".`,
        );
      else owners.set(value, { module, file });
    }
  return problems.length
    ? {
        status: 'error',
        title: 'Service aliases collide',
        details: problems,
        fix: 'Change one exposeAs, or drop it and use services.<plugin>.<name>.',
      }
    : { status: 'ok', title: 'Service names are unique' };
}
async function checkStyles(project, description) {
  if (!description.styles.length) return { status: 'ok', title: 'No package styles to import' };
  const candidates = ['src/app/globals.css', 'app/globals.css', 'src/styles.css', 'src/index.css'];
  for (const file of candidates) {
    const css = await readFile(path.join(project.root, file), 'utf8').catch(() => '');
    if (css.includes('bitakit.gen.css'))
      return { status: 'ok', title: `Package styles are imported in ${file}` };
    if (css && description.styles.every((specifier) => css.includes(specifier)))
      return { status: 'ok', title: `Package styles are imported individually in ${file}` };
  }
  const target = project.framework === 'tanstack' ? 'src/styles.css' : 'src/app/globals.css';
  const relative = path.relative(
    path.dirname(path.join(project.root, target)),
    path.join(
      description.appDirectory === '.'
        ? project.root
        : path.join(project.root, description.appDirectory),
      'bitakit.gen.css',
    ),
  );
  return {
    status: 'warn',
    title: 'Installed packages ship styles that are not imported',
    details: description.styles,
    fix: `Add this line after @import 'tailwindcss'; in ${target}:\n\n@import '${relative.split(path.sep).join('/')}';`,
  };
}
/** Discovery warnings are either deprecations that migrate fixes, or files it skips. */
const isDeprecation = (warning) => warning.includes('bitakit migrate');
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
function checkIgnored(description) {
  const ignored = description.warnings.filter((warning) => !isDeprecation(warning));
  if (!ignored.length)
    return { status: 'ok', title: 'Every contribution file has a default export' };
  return {
    status: 'warn',
    title: `${plural(ignored.length, 'file')} in contribution folders ${ignored.length === 1 ? 'is' : 'are'} ignored by discovery`,
    details: ignored,
    fix: 'Add a default export to each file, or prefix helper files with "-" so discovery skips them on purpose.',
  };
}
/** A slot file nobody renders is a silent no-op; layouts declare the slots they render. */
function checkSlots(description) {
  const declared = new Set(description.slots ?? []);
  const problems = [];
  for (const module of [description.app, ...description.plugins])
    for (const slot of module.slots ?? [])
      if (!declared.has(slot.path))
        problems.push(
          `${slot.file} targets slot "${slot.path}", which no installed layout declares.`,
        );
  if (!problems.length)
    return {
      status: 'ok',
      title: declared.size
        ? `Slot files target declared slots (${[...declared].join(', ')})`
        : 'No layout slots are declared',
    };
  return {
    status: 'warn',
    title: `${plural(problems.length, 'slot file')} target${problems.length === 1 ? 's' : ''} an undeclared slot`,
    details: problems,
    fix: 'Use a slot the layout renders, or list the slot under "slots" in bitakit.config.ts when your own layout renders it.',
  };
}
function checkDeprecated(description) {
  const deprecated = description.warnings.filter(isDeprecation);
  if (!deprecated.length) return { status: 'ok', title: 'Folder layout is current' };
  return {
    status: 'warn',
    title: `${plural(deprecated.length, 'file')} use${deprecated.length === 1 ? 's' : ''} a deprecated layout`,
    details: deprecated,
    fix: 'Run "npx bitakit migrate" to rename and move them.',
  };
}
