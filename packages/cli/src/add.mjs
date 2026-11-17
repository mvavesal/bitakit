import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {
  contributionSegments,
  describeBitaKit,
  describeDefinitions,
  describeModule,
} from '@bitakit/discovery';
import { exists, findProject } from './project.mjs';
import { appPluginAgentRules, claudeFileFor } from './agent-rules.mjs';
import { providedKeys } from './doctor.mjs';
import { serverHostNote, serverRoute, serverRouteFor } from './routes.mjs';
import {
  actionFile,
  configFile,
  eventsFile,
  interceptorFile,
  layoutFile,
  pageFile,
  settingsFile,
  settingsPageFile,
  slotFile,
  slotDefinitionFile,
  dialogFile,
  providerFile,
  pluginFiles,
  remoteActionFile,
  serverActionFile,
  serverInterceptorFile,
  serverServiceFile,
  serverTestFile,
  serviceFile,
  starterFiles,
  testFile,
  titleOf,
  validateName,
} from './templates.mjs';

/** Paths that apps already own; a plugin page there would never be reached. */
const reserved = new Set(['settings', 'api', 'login', 'register']);

/** Writes files that do not exist yet; never overwrites anything. */
export async function writeNewFiles(root, files) {
  const targets = Object.keys(files).map((file) => path.join(root, file));
  for (const target of targets)
    if (await exists(target)) throw new Error(`${target} already exists. Nothing was changed.`);
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return targets;
}

/** Templates are written relative to the plugin directory, so the configuration must be readable. */
async function configuredProject(cwd) {
  const project = await findProject(cwd);
  if (project.configError) throw project.configError;
  return project;
}

/** `bitakit add plugin <name>`: a new folder under the app's plugin directory. */
export async function addPlugin(name, { cwd, minimal = false, example = false } = {}) {
  validateName(name, 'plugin name');
  const project = await configuredProject(cwd);
  if (project.kind !== 'app')
    throw new Error('This is a plugin package. Run "bitakit add plugin" inside an app.');
  if (!minimal && reserved.has(name))
    throw new Error(`"${name}" is reserved for app routes. Choose another plugin name.`);
  const root = path.join(project.pluginsDirectory, name);
  if (await exists(root)) throw new Error(`${root} already exists. Nothing was changed.`);
  const manifest = project.manifest;
  const navigationSlot = { ...manifest.devDependencies, ...manifest.dependencies }['@bitakit/shell']
    ? 'shell.navigation'
    : undefined;
  // Default: the smallest feature (a page and its menu entry); --example writes a complete one.
  const files = minimal
    ? pluginFiles(name, { minimal: true, navigationSlot })
    : example
      ? pluginFiles(name, { navigationSlot })
      : starterFiles(name, { navigationSlot });
  const created = await writeNewFiles(root, {
    ...files,
    'AGENTS.md': appPluginAgentRules(name, files, { navigationSlot }),
    'CLAUDE.md': claudeFileFor(),
  });
  return {
    project,
    root,
    created,
    title: titleOf(name),
    path: minimal ? undefined : `/${name}`,
    // Only a placed open Action shows in a navigation; without Shell the page is reached by URL.
    navigation: !minimal && Boolean(navigationSlot),
  };
}

export const contributionKinds = [
  'action',
  'service',
  'page',
  'interceptor',
  'config',
  'events',
  'settings',
  'settings-page',
  'layout',
  'slot',
  'slot-definition',
  'dialog',
  'provider',
  'test',
];
/** Declared once per plugin, in one root file. */
const singleFile = {
  events: 'events.ts',
  settings: 'settings.ts',
  'settings-page': 'ui/settings/page.tsx',
};

/** The kinds `--server` writes into a plugin's `server/` folder. */
export const serverKinds = ['action', 'service', 'interceptor'];

/**
 * `bitakit add <kind> <plugin>/<name>` in an app, or `<name>` in a plugin package. Nested names
 * such as `notes/team/invite` create `actions/team/invite.ts` with the ID `notes.team.invite`.
 * `events` takes only the plugin: a plugin declares its events once in `events.ts`. `test` also
 * takes only an existing plugin of an app and writes `tests/<plugin>.test.ts` at the app root.
 * `server: true` writes an action, service or interceptor into the plugin's `server/` folder
 * instead (see `addServer`).
 */
export async function addContribution(
  kind,
  target,
  { cwd, plugin: layoutPlugin, server = false } = {},
) {
  if (!contributionKinds.includes(kind))
    throw new Error(`Unknown kind "${kind}". Use ${contributionKinds.join(', ')}.`);
  if (server && !serverKinds.includes(kind))
    throw new Error(`--server applies to ${serverKinds.join(', ')}, not to ${kind}.`);
  const project = await configuredProject(cwd);
  if (server && project.kind !== 'app')
    throw new Error(
      'Plugin packages have no server half yet. Run "bitakit add <kind> <plugin>/<name> --server" inside an app.',
    );
  if (kind === 'test') return addTest(project, target);
  if (kind === 'layout') return addLayout(project, target, layoutPlugin);
  const single = Object.hasOwn(singleFile, kind);
  const example = single
    ? `bitakit add ${kind} notes`
    : `bitakit add ${kind} notes/${target || 'archive'}`;
  let plugin;
  let createdPlugin = false;
  let name = target ?? '';
  let moduleRoot;
  if (project.kind === 'plugin') {
    plugin = project.pluginId;
    moduleRoot = project.moduleRoot;
    // The package is the plugin; naming it is allowed but not needed.
    if (single && name === plugin) name = '';
  } else {
    const slash = name.indexOf('/');
    [plugin, name] =
      slash >= 0
        ? [name.slice(0, slash), name.slice(slash + 1)]
        : single
          ? [name, '']
          : [undefined, name];
    if (!plugin) throw new Error(`Name the plugin too, for example "${example}".`);
    validateName(plugin, 'plugin name');
    moduleRoot = path.join(project.pluginsDirectory, plugin);
    // A plugin is just its folder: the first contribution creates it.
    createdPlugin = !(await exists(moduleRoot));
  }
  if (single) {
    if (name)
      throw new Error(
        `${kind === 'events' ? 'Events' : 'Settings'} are declared once per plugin in ${singleFile[kind]}: run "bitakit add ${kind}${project.kind === 'plugin' ? '' : ` ${plugin}`}" without a further name.`,
      );
  } else {
    if (!name) throw new Error(`Name the ${kind}, for example "${example}".`);
    // Dots and folders mean the same, as in discovery: notes/app-bar.end equals notes/app-bar/end.
    name = contributionSegments(name).join('/');
    name.split('/').forEach((segment) => validateName(segment, `${kind} name`));
  }
  const segments = name ? name.split('/') : [];
  const dotted = segments.join('.');
  if (server)
    return addServer(kind, project, { plugin, name, segments, moduleRoot, createdPlugin });
  // ui/pages/team/index.tsx serves /<plugin>/team, exactly as discovery derives it.
  const pageSegments = segments.at(-1) === 'index' ? segments.slice(0, -1) : segments;
  const pagePath = `/${plugin}${pageSegments.map((segment) => `/${segment}`).join('')}`;
  const files = {
    action: () => ({ [`actions/${name}.ts`]: actionFile(name, plugin) }),
    service: () => ({ [`services/${name}.ts`]: serviceFile(name, plugin) }),
    page: () => ({
      [`ui/pages/${name}.tsx`]: pageFile(plugin, pagePath, titleOf(pageSegments.at(-1) ?? plugin)),
    }),
    interceptor: () => ({ [`interceptors/${name}.ts`]: interceptorFile(plugin, name) }),
    config: () => ({ [`configs/${name}.ts`]: configFile(dotted) }),
    events: () => ({ 'events.ts': eventsFile(plugin) }),
    settings: () => ({ 'settings.ts': settingsFile(plugin) }),
    'settings-page': () => ({ 'ui/settings/page.tsx': settingsPageFile() }),
    slot: () => ({ [`ui/slots/${name}.tsx`]: slotFile(plugin, dotted) }),
    'slot-definition': () => ({ [`slots/${name}.ts`]: slotDefinitionFile(`${plugin}.${dotted}`) }),
    dialog: () => ({ [`ui/dialogs/${name}.tsx`]: dialogFile(plugin, dotted) }),
    provider: () => ({ [`ui/providers/${name}.tsx`]: providerFile(plugin, dotted) }),
  }[kind];
  const created = await writeNewFiles(moduleRoot, files());
  return {
    project,
    created,
    createdPlugin,
    // A ui/slots file fills the slot named by its path, which is not prefixed with this plugin.
    id: single ? `${plugin}.*` : kind === 'slot' ? dotted : `${plugin}.${dotted}`,
    plugin,
    path: kind === 'page' ? pagePath : undefined,
  };
}

/**
 * Name segments no server operation may use: as properties of `remote` they would make it
 * thenable, observable or converting. The lowercase ones of Core's list; the others are not
 * valid file names here anyway.
 */
const reservedSegments = new Set([
  'then',
  'catch',
  'finally',
  'subscribe',
  'constructor',
  'prototype',
]);

/** The file of the plugin's client Action `id` (its button) in any spelling, if it has one. */
async function buttonOf(moduleRoot, id, plugin) {
  if (!(await exists(moduleRoot))) return undefined;
  const { directory, actions } = await describeModule(moduleRoot);
  const { definitions, unresolved } = await describeDefinitions(actions, {
    helper: 'defineAction',
    moduleId: plugin,
  });
  // A file that cannot be read statically may declare it; its path decides then.
  const file =
    definitions.find((definition) => definition.id === id)?.file ??
    actions.find((entry) => unresolved.includes(entry.file) && `${plugin}.${entry.path}` === id)
      ?.file;
  // Discovery reports real paths; name the file as the caller knows the folder.
  return file && path.join(moduleRoot, path.relative(directory, file));
}

/** Whether `@bitakit/core` as installed has the `./server` entry server files import. */
async function coreHasServer(root) {
  for (let folder = root; ; folder = path.dirname(folder)) {
    const manifest = await readFile(
      path.join(folder, 'node_modules/@bitakit/core/package.json'),
      'utf8',
    )
      .then(JSON.parse)
      .catch(() => undefined);
    if (manifest) return Boolean(manifest.exports?.['./server']);
    if (path.dirname(folder) === folder) return true;
  }
}

/** Whether the CLI's `@bitakit/discovery` reads `server/` folders (0.3.1 and newer). */
async function discoveryHasServer(project, moduleRoot) {
  for (const directory of [moduleRoot, project.appDirectory])
    if (await exists(directory)) return (await describeModule(directory)).server !== undefined;
  return true;
}

/**
 * Whether no server service of the app or an enabled plugin provides `requestContext`, read
 * statically. Without a provider the server refuses to start once a non-public operation exists;
 * a key whose name cannot be read counts as a provider.
 */
async function needsRequestContext(project) {
  // Only a hint: a project discovery cannot describe gets none (generate reports the problem).
  const description = await describeBitaKit(project.root).catch(() => undefined);
  if (!description) return false;
  const entries = [description.app, ...description.plugins.filter((item) => item.enabled)].flatMap(
    (module) => module.server?.services ?? [],
  );
  const { names, unresolved } = await providedKeys(description.root, entries);
  return !unresolved && !names.includes('requestContext');
}

/**
 * `bitakit add <action|service|interceptor> <plugin>/<name> --server`: the file in the plugin's
 * `server/` folder. An action also gets its test (`tests/<id>.server.test.ts`, which mounts the
 * server half), the button that calls it through `remote` when the plugin has none with that ID,
 * and the RPC route when no app route hands `<endpoint>/x` to BitaKit yet and the framework has
 * a server host for it (`noHost` otherwise). `needsProvider` tells that no server service
 * provides `requestContext` yet. Nothing is written when any of these files exists; nothing is
 * ever overwritten.
 */
async function addServer(kind, project, { plugin, name, segments, moduleRoot, createdPlugin }) {
  const id = `${plugin}.${segments.join('.')}`;
  const folder = path.relative(project.root, moduleRoot).split(path.sep).join('/');
  const files = {};
  const kept = [];
  let route;
  let noHost;
  let needsProvider = false;
  let setup = [];
  let run;
  if (kind === 'service')
    files[`${folder}/server/services/${name}.ts`] = serverServiceFile(name, plugin);
  else if (kind === 'interceptor')
    files[`${folder}/server/interceptors/${name}.ts`] = serverInterceptorFile(plugin, name);
  else {
    const reserved = id.split('.').find((segment) => reservedSegments.has(segment));
    if (reserved)
      throw new Error(
        `"${reserved}" cannot name a server operation: remote.${id} would make remote thenable or observable. Choose another name.`,
      );
    const button = await buttonOf(moduleRoot, id, plugin);
    files[`${folder}/server/actions/${name}.ts`] = serverActionFile(name, plugin, {
      button: button && path.relative(moduleRoot, button).split(path.sep).join('/'),
    });
    if (button) kept.push(button);
    else files[`${folder}/actions/${name}.ts`] = remoteActionFile(name, plugin);
    const test = `tests/${id}.server.test.ts`;
    files[test] = serverTestFile(name, plugin, {
      directory: folder,
      // Under plugins/, mountServer reads the same ID from plugin.config.ts or the folder name.
      id: path.basename(project.pluginsDirectory) === 'plugins' ? undefined : plugin,
    });
    const caught = await serverRouteFor(project, project.serverEndpoint);
    const written = caught
      ? undefined
      : await serverRoute(project, { endpoint: project.serverEndpoint });
    if (caught) route = { file: caught.file, created: false };
    else if (written) {
      files[written.file] = written.content;
      route = { file: written.file, created: true };
    } else
      noHost = serverHostNote(
        project.serverEndpoint,
        path
          .relative(project.root, path.join(project.appDirectory, 'bitakit.gen.server.ts'))
          .split(path.sep)
          .join('/'),
      );
    needsProvider = await needsRequestContext(project);
    ({ setup, run } = testSetup(project.manifest, test));
    const installed = { ...project.manifest.dependencies, ...project.manifest.devDependencies };
    // Server files need Core's /server entry, and discovery 0.3.1 to generate and test them.
    const core = await coreHasServer(project.root);
    const discovery = await discoveryHasServer(project, moduleRoot);
    setup = [
      ...(installed.zod ? [] : ['npm install zod']),
      ...(core && discovery
        ? []
        : [`npm install ${core ? '' : '@bitakit/core@latest '}@bitakit/discovery@latest`]),
      ...setup,
    ];
  }
  const created = await writeNewFiles(project.root, files);
  return {
    project,
    created,
    createdPlugin,
    id,
    plugin,
    server: true,
    kept,
    route,
    noHost,
    needsProvider,
    remote: kind === 'action' ? `remote.${id}` : undefined,
    setup,
    run,
  };
}

/**
 * `bitakit add layout <family>[/<variant>]`: a candidate for the `layout.<family>` slot, in the
 * app's `src/layouts`, an app plugin's `ui/layouts` (`--plugin`) or a plugin package's `ui/layouts`.
 */
async function addLayout(project, target, plugin) {
  if (!target)
    throw new Error(
      'Name the layout family, for example "bitakit add layout auth" or "bitakit add layout auth/split".',
    );
  const [family, variant, ...rest] = target.split('/');
  if (rest.length) throw new Error(`Use "<family>" or "<family>/<variant>", not "${target}".`);
  validateName(family, 'layout family');
  if (variant !== undefined) validateName(variant, 'layout variant');
  const file = `${variant === undefined ? family : `${family}/${variant}`}.tsx`;
  let root;
  let folder = 'ui/layouts';
  if (project.kind === 'plugin') {
    if (plugin)
      throw new Error('Inside a plugin package, run "bitakit add layout" without --plugin.');
    root = project.moduleRoot;
  } else if (plugin) {
    validateName(plugin, 'plugin name');
    root = path.join(project.pluginsDirectory, plugin);
    if (!(await exists(root)))
      throw new Error(
        `There is no plugin "${plugin}". Create it first: bitakit add plugin ${plugin}.`,
      );
  } else {
    root = project.appDirectory;
    folder = 'layouts';
  }
  const created = await writeNewFiles(root, {
    [`${folder}/${file}`]: layoutFile(family, variant),
  });
  return { project, created, id: `layout.${family}`, plugin, path: undefined };
}

/** What `mountPlugin` needs under Node besides `@bitakit/core`, as the testing guide lists it. */
const testDependencies = ['@bitakit/discovery', 'jiti', 'typescript', '@types/node'];

const nameOf = (node) =>
  ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : undefined;

/**
 * The Shell slots a plugin's Actions are placed in: the `'shell.…'` entries of every `slots: [...]`
 * in its action files, written as a string or as `{ slot }`. Read from the syntax tree, never run.
 */
async function shellSlotsOf(directory) {
  const slots = new Set();
  for (const { file } of (await describeModule(directory)).actions) {
    const visit = (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        nameOf(node.name) === 'slots' &&
        ts.isArrayLiteralExpression(node.initializer)
      )
        for (const element of node.initializer.elements) {
          const target = ts.isObjectLiteralExpression(element)
            ? element.properties.find(
                (item) => ts.isPropertyAssignment(item) && nameOf(item.name) === 'slot',
              )?.initializer
            : element;
          if (target && ts.isStringLiteralLike(target) && target.text.startsWith('shell.'))
            slots.add(target.text.slice('shell.'.length));
        }
      ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true));
  }
  return [...slots].sort();
}

/** The commands an app still needs to run the test; the CLI never edits package.json itself. */
function testSetup(manifest, file) {
  const installed = { ...manifest.dependencies, ...manifest.devDependencies };
  const missing = testDependencies.filter((name) => !installed[name]);
  const script = manifest.scripts?.test;
  // npm init writes a test script that only fails; it counts as missing.
  const needsScript = !script || /no test specified/.test(script);
  return {
    setup: [
      ...(missing.length ? [`npm install --save-dev ${missing.join(' ')}`] : []),
      ...(manifest.type === 'module' ? [] : ['npm pkg set type=module']),
      ...(needsScript ? ['npm pkg set scripts.test="node --test tests/*.test.ts"'] : []),
    ],
    run: needsScript || script.includes('node --test') ? 'npm test' : `node --test ${file}`,
  };
}

/** `bitakit add test <plugin>`: tests/<plugin>.test.ts at the app root, mounting that plugin folder. */
async function addTest(project, plugin) {
  if (project.kind !== 'app')
    throw new Error(
      'Run "bitakit add test <plugin>" inside an app; a plugin package keeps its tests in tests/.',
    );
  if (!plugin) throw new Error('Name the plugin, for example "bitakit add test notes".');
  if (plugin.includes('/'))
    throw new Error(
      `A test covers a whole plugin: run "bitakit add test ${plugin.slice(0, plugin.indexOf('/'))}" without a further name.`,
    );
  validateName(plugin, 'plugin name');
  const directory = path.join(project.pluginsDirectory, plugin);
  if (!(await exists(directory)))
    throw new Error(
      `${directory} does not exist. Create the plugin first, for example "bitakit add plugin ${plugin}". Nothing was changed.`,
    );
  const relativeDirectory = path.relative(project.root, directory).split(path.sep).join('/');
  // The app's ID for the folder, so the test mounts the plugin as the app does.
  const id =
    (await describeBitaKit(project.root)).plugins.find(
      (entry) => entry.directory === relativeDirectory,
    )?.id ?? plugin;
  const file = `tests/${plugin}.test.ts`;
  const created = await writeNewFiles(project.root, {
    [file]: testFile(plugin, {
      directory: relativeDirectory,
      // Under plugins/, mountPlugin reads the same ID from plugin.config.ts or the folder name.
      id: path.basename(project.pluginsDirectory) === 'plugins' ? undefined : id,
      shellSlots: await shellSlotsOf(directory),
    }),
  });
  return { project, created, plugin, id, ...testSetup(project.manifest, file) };
}
