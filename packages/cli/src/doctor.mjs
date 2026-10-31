import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {
  describeBitaKit,
  describeModule,
  describeDefinitions,
  cssImports,
  navigationPlacement,
} from '@bitakit/discovery';
import { checkAgentFiles } from './doctor-agent-files.mjs';
import { exists, findProject } from './project.mjs';
import { appRoutes, catchAllRoute, rootLayouts, shellGroup } from './routes.mjs';
import { describeSlots } from './slots.mjs';
import { identityConflictsFromDescription } from './inventory.mjs';

/**
 * Checks a project for the problems that most often break a BitaKit app: mixed package
 * versions, duplicate Core copies, missing wiring, unreachable plugin pages and links,
 * colliding service aliases, `requires` nobody satisfies, plugin dependency cycles, missing
 * styles, deprecated layouts and agent files that are out of sync.
 * Each result: `{ status: 'ok' | 'warn' | 'error', title, details, fix }`.
 */
export async function doctor({ cwd } = {}) {
  const project = await findProject(cwd);
  const results = [await checkVersions(project), await checkCopies(project)];
  if (project.kind === 'plugin') {
    results.push(checkPluginPackage(project));
    try {
      if (!(await exists(project.moduleRoot))) return { project, results };
      const module = await describeModule(project.moduleRoot);
      const info = await describeDefinitions(module.slotDefinitions, {
        helper: 'defineSlot',
        moduleId: project.pluginId,
        properties: ['accepts', 'policy'],
      });
      results.push(
        checkSlots({
          app: { ...module, slots: [] },
          plugins: [],
          slots: [],
          slotDeclarations: info.definitions,
          unresolvedSlots: info.unresolved,
        }),
      );
    } catch (error) {
      results.push({ status: 'error', title: 'Slot discovery failed', details: [error.message] });
    }
    return { project, results };
  }
  if (project.configError) {
    results.push({
      status: 'error',
      title: `${path.basename(project.configFile)} could not be loaded`,
      details: [project.configError.message],
      fix: project.legacyConfig
        ? 'Run "npx bitakit migrate": it rewrites foundation.config.ts to bitakit.config.ts with defineBitaKit from @bitakit/discovery.'
        : 'Fix the error above; discovery reads this file to find your plugins.',
    });
    return { project, results };
  }
  let description;
  try {
    description = await describeBitaKit(project.root, {
      packageMetadataOnly: true,
      auditPackageStyles: true,
    });
  } catch (error) {
    results.push({ status: 'error', title: 'Discovery failed', details: [error.message] });
    return { project, results };
  }
  const identityConflicts = identityConflictsFromDescription(description);
  if (identityConflicts.length)
    results.push({
      status: 'error',
      title: 'Conflicting static plugin IDs',
      details: identityConflicts,
    });
  const metadataWarnings = description.metadataWarnings ?? [];
  if (metadataWarnings.length)
    results.push({
      status: 'warn',
      title: 'Plugin metadata',
      details: [...new Set(metadataWarnings)],
      fix: 'Correct the optional declaration at its source. Local membership is derived; folder declarations retain precedence over package fallbacks.',
    });
  if (description.packageWarnings?.length)
    results.push({
      status: 'warn',
      title: 'Installed package copies',
      details: description.packageWarnings,
    });
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
  results.push(await checkRequirements(project, description, scanned));
  results.push(...checkGraph(description));
  results.push(await checkStyles(project, description));
  results.push(...(await checkTailwind(project, description)));
  results.push(checkIgnored(description), checkDeprecated(description), checkSlots(description));
  results.push(await checkParts(description));
  if (shell) {
    const missing = [];
    for (const module of modules)
      for (const entry of module.actions) {
        const source = await readFile(path.join(project.root, entry.file), 'utf8');
        for (const issue of navigationPlacement(source).missing)
          missing.push(
            `${entry.file}:${issue.line}: navigation group has no explicit slot placement.`,
          );
      }
    if (missing.length)
      results.push({
        status: 'warn',
        title: 'Navigation Actions still rely on groups',
        details: missing,
        fix: 'Choose the intended owner slot. For the default Shell run bitakit migrate --navigation-slot shell.navigation --dry-run, review it, then apply. Logical groups alone do not place UI.',
      });
  }
  const agentFiles = await checkAgentFiles(project);
  if (agentFiles) results.push(agentFiles);
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
      // Private workspace apps link into node_modules too; they are not published packages.
      if (manifest?.version && !manifest.private)
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
  // Only changed packages get a patch release, so patch versions may differ within one line.
  const lines = [...new Set(packages.map((item) => releaseLine(item.version)))];
  if (lines.length === 1)
    return {
      status: 'ok',
      title: `All ${packages.length} @bitakit packages are on the ${lines[0]}.x release line`,
    };
  return {
    status: 'error',
    title: 'Mixed @bitakit versions',
    details: packages.map((item) => `${item.name}@${item.version}`),
    fix: `Install one release for all of them: npm install ${packages.map((item) => `${item.name}@latest`).join(' ')}`,
  };
}
/** The versions a caret range accepts together: `0.2` for 0.2.x, `1` for 1.x. */
function releaseLine(version) {
  const [major, minor] = version.split('.');
  return major === '0' ? `0.${minor}` : major;
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
      /withBitaKit/.test(config)
        ? { status: 'ok', title: 'next.config wraps the configuration with withBitaKit' }
        : /withFoundation/.test(config)
          ? {
              status: 'error',
              title: 'next.config uses withFoundation, which 0.2 removed',
              fix: 'Run "npx bitakit migrate", or rename withFoundation to withBitaKit.',
            }
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
      /\bbitakit\(/.test(config)
        ? { status: 'ok', title: 'vite.config runs the BitaKit plugin' }
        : /\bfoundation\(/.test(config)
          ? {
              status: 'error',
              title: 'vite.config uses foundation(), which 0.2 removed',
              fix: 'Run "npx bitakit migrate", or import { bitakit } from \'@bitakit/tanstack/config\' and call bitakit().',
            }
          : {
              status: 'error',
              title: 'vite.config does not run BitaKit discovery',
              fix: "import { bitakit } from '@bitakit/tanstack/config';\nplugins: [bitakit(), tanstackStart(), ...]",
            },
    );
  }
  let provider = false;
  for (const file of rootLayouts(project))
    if (await mountsProvider(path.join(project.root, file), project.root)) provider = true;
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

/** Follow statically rendered local wrappers; an unused import or comment is not a mount. */
async function mountsProvider(file, root, seen = new Set()) {
  if (seen.has(file)) return false;
  seen.add(file);
  const code = await readFile(file, 'utf8').catch(() => '');
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map();
  const rendered = new Set();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const from = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (clause?.name) imports.set(clause.name.text, { from, name: 'default' });
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings))
      for (const binding of clause.namedBindings.elements)
        imports.set(binding.name.text, {
          from,
          name: binding.propertyName?.text ?? binding.name.text,
        });
  }
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      rendered.add(node.tagName.getText(tree));
    ts.forEachChild(node, visit);
  };
  visit(tree);
  for (const name of rendered) {
    const entry = imports.get(name);
    if (!entry) continue;
    // The generated file exports BitaKitProvider; the packages export BitaKitRuntimeProvider.
    if (
      (entry.name === 'BitaKitProvider' && /bitakit\.gen$/.test(entry.from)) ||
      (entry.name === 'BitaKitRuntimeProvider' &&
        /^@bitakit\/(?:ui|next|tanstack)$/.test(entry.from))
    )
      return true;
    const base = entry.from.startsWith('@/')
      ? path.join(root, 'src', entry.from.slice(2))
      : entry.from.startsWith('.')
        ? path.resolve(path.dirname(file), entry.from)
        : undefined;
    if (!base) continue;
    for (const target of [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      `${base}.jsx`,
      `${base}.js`,
      path.join(base, 'index.tsx'),
    ]) {
      if (await mountsProvider(target, root, seen)) return true;
    }
  }
  return false;
}

const unwrap = (node) =>
  ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node;
/** The string literals of a value, or of the elements of an array literal: `'a'` and `['a', 'b']`. */
const stringsOf = (node) => {
  const value = unwrap(node);
  return (ts.isArrayLiteralExpression(value) ? value.elements : [value]).filter(
    ts.isStringLiteralLike,
  );
};
async function parse(root, entry) {
  const source = await readFile(path.join(root, entry.file), 'utf8').catch(() => undefined);
  return source === undefined
    ? undefined
    : ts.createSourceFile(entry.file, source, ts.ScriptTarget.Latest, true);
}
/** String literal values of `property` in calls such as `defineAction({ href: '/x' })`; array elements count too. */
async function literals(root, entries, callees, property) {
  const found = [];
  for (const entry of entries) {
    const file = await parse(root, entry);
    if (!file) continue;
    const visit = (node) => {
      // Options may follow a factory argument: defineService(() => ..., { exposeAs: 'items' }).
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        callees.includes(node.expression.text)
      )
        for (const argument of node.arguments.filter(ts.isObjectLiteralExpression))
          for (const item of argument.properties)
            if (ts.isPropertyAssignment(item) && item.name.getText(file) === property)
              for (const value of stringsOf(item.initializer))
                found.push({ value: value.text, file: entry.file });
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}
/** String literals of a top-level `export const <name> = [...]`, such as the `requires` of a provider file. */
async function exportedLiterals(root, entries, name) {
  const found = [];
  for (const entry of entries) {
    const file = await parse(root, entry);
    for (const statement of file?.statements ?? [])
      if (
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)
      )
        for (const { name: declared, initializer } of statement.declarationList.declarations)
          if (ts.isIdentifier(declared) && declared.text === name && initializer)
            for (const value of stringsOf(initializer))
              found.push({ value: value.text, file: entry.file });
  }
  return found;
}
/** Contract names of the keys core exports; other keys are read from `serviceKey('name')` in the same file. */
const coreKeys = new Map([
  ['authService', 'auth'],
  ['translationService', 'i18n'],
  ['settingsStorage', 'settings.storage'],
]);
/** Contract names that services register with `provides`; `unresolved` when a key's name cannot be read. */
async function providedKeys(root, entries) {
  const names = [];
  let unresolved = false;
  for (const entry of entries) {
    const file = await parse(root, entry);
    if (!file) continue;
    const declared = new Map();
    const used = [];
    const nameOf = (node) =>
      // `defineContract('name').of<T>()` carries its name in the inner call.
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'of'
        ? nameOf(node.expression.expression)
        : ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            ['serviceKey', 'defineContract'].includes(node.expression.text) &&
            node.arguments[0] &&
            ts.isStringLiteralLike(node.arguments[0])
          ? node.arguments[0].text
          : undefined;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const name = nameOf(node.initializer);
        if (name) declared.set(node.name.text, name);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'defineService'
      ) {
        // Options held in a variable cannot be read.
        if (node.arguments.slice(1).some((argument) => !ts.isObjectLiteralExpression(argument)))
          unresolved = true;
        for (const argument of node.arguments.filter(ts.isObjectLiteralExpression))
          for (const item of argument.properties)
            if (item.name?.getText(file) === 'provides')
              used.push(ts.isPropertyAssignment(item) ? item.initializer : item.name);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    for (const key of used) {
      const name = ts.isIdentifier(key)
        ? (declared.get(key.text) ?? coreKeys.get(key.text))
        : nameOf(key);
      if (name) names.push(name);
      else unresolved = true;
    }
  }
  return { names, unresolved };
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
/**
 * Every `requires` of a service, action, interceptor or provider must name something the
 * composition provides: a service ID, an `exposeAs` alias or a `provides` contract. Local
 * plugins are fully known, so dotted names in their namespace are checked exactly. Installed
 * plugin packages, host `services` and keys declared in other files can provide any other name,
 * so those are only checked when none of them exist.
 */
async function checkRequirements(project, description, scanned) {
  const root = project.root;
  const services = new Set();
  const providers = new Set();
  const disabled = new Map();
  let unresolved = false;
  const idOf = (module, entry) => (module.isApp ? entry.path : `${module.id}.${entry.path}`);
  for (const { module, aliases } of scanned) {
    for (const entry of module.services) services.add(idOf(module, entry));
    for (const entry of module.providers) providers.add(idOf(module, entry));
    // The app module carries its configured ID as a prefix only when plugin.config.ts sets one.
    if (module.isApp)
      for (const entry of module.services) services.add(`${module.id}.${entry.path}`);
    for (const { value } of aliases) services.add(value);
    const provided = await providedKeys(root, module.services);
    provided.names.forEach((name) => services.add(name));
    unresolved ||= provided.unresolved;
  }
  for (const plugin of description.plugins.filter((item) => !item.enabled))
    for (const entry of [...plugin.services, ...plugin.providers])
      disabled.set(`${plugin.id}.${entry.path}`, plugin.id);
  let hosted = false;
  for (const file of rootLayouts(project))
    hosted ||= /\bservices\s*=/.test(await readFile(path.join(root, file), 'utf8').catch(() => ''));
  const namespaces = new Set([description.app.id, ...description.plugins.map((item) => item.id)]);
  const open = description.packages.length > 0 || unresolved || hosted;
  let count = 0;
  const problems = [];
  for (const { module } of scanned) {
    const found = [
      ...(
        await Promise.all([
          literals(root, module.services, ['defineService'], 'requires'),
          literals(root, module.actions, ['defineAction'], 'requires'),
          literals(root, module.interceptors, ['defineInterceptor'], 'requires'),
        ])
      )
        .flat()
        .map((item) => ({ ...item, provider: false })),
      ...(await exportedLiterals(root, module.providers, 'requires')).map((item) => ({
        ...item,
        provider: true,
      })),
    ];
    for (const { value, file, provider } of found) {
      count++;
      if (services.has(value) || (provider && providers.has(value))) continue;
      // Only dotted names can be IDs inside a local plugin; a flat name such as "auth" is a contract.
      const [namespace] = value.split('.');
      const local = value.includes('.') && namespaces.has(namespace);
      if (!local && open) continue;
      const owner = disabled.get(value);
      const siblings = [...services, ...providers].filter(
        (name) => name.split('.')[0] === namespace,
      );
      problems.push(
        `${label(module)} requires "${value}" (${file}), but ${
          owner
            ? `plugin "${owner}", which provides it, is disabled`
            : `no ${provider ? 'provider, ' : ''}service, alias or contract has that name`
        }.${local && siblings.length ? ` Available in "${namespace}": ${siblings.join(', ')}.` : ''}`,
      );
    }
  }
  return problems.length
    ? {
        status: 'error',
        title: 'Some required services are not provided',
        details: problems,
        fix: 'Correct the name, add the service, or install and enable the plugin that provides it.',
      }
    : {
        status: 'ok',
        title: !count
          ? 'No service requirements'
          : count === 1
            ? 'The service requirement can be satisfied'
            : `All ${count} service requirements can be satisfied`,
      };
}
/** Plugin `dependencies` must not form a cycle, and the plugins they name must be enabled. */
function checkGraph(description) {
  const dependenciesOf = (plugin) =>
    Array.isArray(plugin.dependencies) ? plugin.dependencies : [];
  const enabled = new Map(
    description.plugins.filter((plugin) => plugin.enabled).map((plugin) => [plugin.id, plugin]),
  );
  const cycles = [];
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      cycles.push([...trail.slice(trail.indexOf(id)), id]);
      return;
    }
    state.set(id, 'visiting');
    for (const dependency of dependenciesOf(enabled.get(id)))
      if (enabled.has(dependency)) visit(dependency, [...trail, id]);
    state.set(id, 'done');
  };
  for (const id of enabled.keys()) visit(id, []);
  const off = new Set(
    description.plugins.filter((plugin) => !plugin.enabled).map((plugin) => plugin.id),
  );
  const disabled = [...enabled.values()].flatMap((plugin) =>
    dependenciesOf(plugin)
      .filter((dependency) => off.has(dependency))
      .map(
        (dependency) =>
          `plugin "${plugin.id}" depends on "${dependency}", which is disabled, so "${plugin.id}" fails to start.`,
      ),
  );
  const results = [];
  if (cycles.length)
    results.push({
      status: 'error',
      title: 'Plugin dependencies form a cycle',
      details: cycles.map((cycle) => cycle.join(' → ')),
      fix: 'Break the cycle with an event, or with a shared service that both plugins can require.',
    });
  if (disabled.length)
    results.push({
      status: 'warn',
      title: 'Enabled plugins depend on disabled plugins',
      details: disabled,
      fix: 'Enable the plugin in plugins.overrides of bitakit.config.ts, or remove it from the dependencies.',
    });
  return results.length ? results : [{ status: 'ok', title: 'Plugin dependencies are consistent' }];
}
/**
 * Package styles use Tailwind (`@source`, `@apply`, imports under the "style" condition), so the
 * root stylesheet must be compiled by the framework's Tailwind integration. A replaced
 * next.config that lost create-next-app's loader rule leaves the app unstyled without an error.
 */
async function checkTailwind(project, description) {
  if (!description.styles.length || !['next', 'tanstack'].includes(project.framework)) return [];
  const read = async (names) =>
    (
      await Promise.all(
        names.map((name) => readFile(path.join(project.root, name), 'utf8').catch(() => '')),
      )
    ).join('\n');
  if (project.framework === 'next') {
    const config = await read(['next.config.ts', 'next.config.mjs', 'next.config.js']);
    const postcss = await read([
      'postcss.config.mjs',
      'postcss.config.js',
      'postcss.config.cjs',
      'postcss.config.ts',
    ]);
    if (/@tailwindcss\/turbopack/.test(config) || /@tailwindcss\/postcss/.test(postcss))
      return [{ status: 'ok', title: 'Tailwind compiles the app styles' }];
    return [
      {
        status: 'error',
        title: 'Tailwind does not compile the app styles',
        fix: "Keep create-next-app's loader rule in next.config, inside withBitaKit({ ... }):\n\nturbopack: { rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } }\n\nor add postcss.config.mjs with the @tailwindcss/postcss plugin.",
      },
    ];
  }
  const vite = await read(['vite.config.ts', 'vite.config.mts', 'vite.config.js']);
  return /@tailwindcss\/vite/.test(vite)
    ? [{ status: 'ok', title: 'Tailwind compiles the app styles' }]
    : [
        {
          status: 'error',
          title: 'Tailwind does not compile the app styles',
          fix: "Add tailwindcss() from '@tailwindcss/vite' to the Vite plugins.",
        },
      ];
}

async function checkStyles(project, description) {
  if (!description.styles.length) return { status: 'ok', title: 'No package styles to import' };
  const visited = new Set();
  const generated = path.resolve(project.root, description.appDirectory, 'bitakit.gen.css');
  const resolveLocal = (specifier, from) =>
    specifier.startsWith('@/')
      ? path.resolve(project.root, 'src', specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(path.dirname(from), specifier)
        : undefined;
  async function followsGenerated(file) {
    if (file === generated) return true;
    if (!file || visited.has(file)) return false;
    visited.add(file);
    const css = await readFile(file, 'utf8').catch(() => undefined);
    if (css === undefined) return false;
    for (const { value } of cssImports(css, file))
      if (await followsGenerated(resolveLocal(value, file))) return true;
    return false;
  }
  try {
    for (const layout of rootLayouts(project)) {
      const file = path.join(project.root, layout);
      const source = await readFile(file, 'utf8').catch(() => '');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      for (const node of tree.statements) {
        if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
        const value = node.moduleSpecifier.text.replace(/\?url$/, '');
        if (!value.endsWith('.css')) continue;
        const entry = resolveLocal(value, file);
        if (await followsGenerated(entry))
          return {
            status: 'ok',
            title: `Package styles are imported in ${path.relative(project.root, entry)}`,
            details: [
              'Static root import graph verified. Rendered cascade, spacing and contrast require browser verification.',
            ],
          };
      }
    }
  } catch (error) {
    return {
      status: 'error',
      title: 'The root stylesheet could not be parsed',
      details: [error.message],
    };
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
/** Metadata/package categories come from their producers, never filenames in warning text. */
const isDeprecation = (warning) => warning.includes('bitakit migrate');
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
function checkIgnored(description) {
  const classified = new Set([
    ...(description.metadataWarnings ?? []),
    ...(description.packageWarnings ?? []),
  ]);
  const ignored = description.warnings.filter(
    (warning) => !isDeprecation(warning) && !classified.has(warning),
  );
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
  const contracts = new Map();
  const duplicates = [];
  for (const entry of description.slotDeclarations ?? []) {
    if (contracts.has(entry.id))
      duplicates.push(
        `Duplicate slot "${entry.id}": ${contracts.get(entry.id).file} and ${entry.file}.`,
      );
    else contracts.set(entry.id, entry);
    declared.add(entry.id);
  }
  if (duplicates.length)
    return {
      status: 'error',
      title: 'Duplicate slot declarations',
      details: duplicates,
      fix: 'Keep one owning definition per canonical slot ID; flat and nested forms are alternatives.',
    };
  const problems = [];
  for (const module of [
    description.app,
    ...description.plugins.filter((item) => item.enabled !== false),
  ])
    for (const slot of module.slots ?? [])
      if (!declared.has(slot.path))
        problems.push(
          `${slot.file} targets slot "${slot.path}", which no installed layout declares.`,
        );
      else if (
        contracts.get(slot.path)?.accepts &&
        contracts.get(slot.path).accepts !== 'component'
      )
        problems.push(
          `${slot.file} contributes a component to "${slot.path}", whose contract accepts ${contracts.get(slot.path).accepts}.`,
        );
  if (description.unresolvedSlots?.length)
    problems.push(
      `Static inspection cannot resolve slot definitions in: ${description.unresolvedSlots.join(', ')}. Runtime normalization and typechecking remain authoritative.`,
    );
  if (!problems.length)
    return {
      status: 'ok',
      // A clean run stays short; `bitakit slots` lists the slots.
      title: declared.size
        ? `Slot files target declared slots (${plural(declared.size, 'slot')} available)`
        : 'No layout slots are declared',
    };
  return {
    status: 'warn',
    title: `${plural(problems.length, 'slot contract issue')} need review`,
    details: problems,
    fix: 'Declare the owner contract with defineSlot in slots/. ui/slots/ contributes components; Action slots must reference declared action contracts. Legacy bitakit.config.ts slots are name hints only.',
  };
}
/**
 * Replaceable (`single`) slots: every `choose` entry names one, and no part has several
 * candidates in the app's files without a decision. Packages add candidates only at runtime.
 */
async function checkParts(description) {
  const { slots } = await describeSlots(description);
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  const problems = [];
  for (const [id, choice] of Object.entries(description.choose ?? {})) {
    const slot = byId.get(id);
    if (!slot)
      problems.push(
        `bitakit.config.ts chooses "${choice}" for "${id}", but no slot "${id}" exists.`,
      );
    else if (slot.policy && slot.policy !== 'single')
      problems.push(
        `bitakit.config.ts chooses "${choice}" for "${id}", a ${slot.policy} slot; choose applies to single slots only.`,
      );
  }
  for (const slot of slots)
    if (slot.selection?.reason === 'ambiguous')
      problems.push(
        `"${slot.id}" has several candidates (${slot.selection.candidates.join(', ')}) and renders its default.`,
      );
  if (!problems.length) return { status: 'ok', title: 'Replaceable parts are decided' };
  return {
    status: 'warn',
    title: `${plural(problems.length, 'replaceable part')} need${problems.length === 1 ? 's' : ''} a decision`,
    details: problems,
    fix: "Pick one per slot in bitakit.config.ts, for example choose: { 'layout.auth': 'split' }, or keep a single candidate. The app's own file wins over plugins without configuration.",
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
