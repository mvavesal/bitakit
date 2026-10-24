import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { contributionSegments, describeBitaKit, describeModule } from '@bitakit/discovery';
import { exists, findProject } from './project.mjs';
import { appPluginAgentRules, claudeFileFor } from './agent-rules.mjs';
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

/**
 * `bitakit add <kind> <plugin>/<name>` in an app, or `<name>` in a plugin package. Nested names
 * such as `notes/team/invite` create `actions/team/invite.ts` with the ID `notes.team.invite`.
 * `events` takes only the plugin: a plugin declares its events once in `events.ts`. `test` also
 * takes only an existing plugin of an app and writes `tests/<plugin>.test.ts` at the app root.
 */
export async function addContribution(kind, target, { cwd, plugin: layoutPlugin } = {}) {
  if (!contributionKinds.includes(kind))
    throw new Error(`Unknown kind "${kind}". Use ${contributionKinds.join(', ')}.`);
  const project = await configuredProject(cwd);
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
