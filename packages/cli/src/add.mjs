import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exists, findProject } from './project.mjs';
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
export async function addPlugin(name, { cwd, minimal = false } = {}) {
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
  const created = await writeNewFiles(root, pluginFiles(name, { minimal, navigationSlot }));
  return { project, root, created, title: titleOf(name), path: minimal ? undefined : `/${name}` };
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
 * `events` takes only the plugin: a plugin declares its events once in `events.ts`.
 */
export async function addContribution(kind, target, { cwd } = {}) {
  if (!contributionKinds.includes(kind))
    throw new Error(`Unknown kind "${kind}". Use ${contributionKinds.join(', ')}.`);
  const project = await configuredProject(cwd);
  if (kind === 'layout') {
    if (project.kind !== 'app')
      throw new Error('Layouts belong to the app: run "bitakit add layout <name>" inside an app.');
    if (!target) throw new Error('Name the layout, for example "bitakit add layout admin".');
    validateName(target, 'layout name');
    const created = await writeNewFiles(project.appDirectory, {
      [`layouts/${target}.tsx`]: layoutFile(target),
    });
    return { project, created, id: target, path: undefined };
  }
  const single = Object.hasOwn(singleFile, kind);
  const example = single
    ? `bitakit add ${kind} notes`
    : `bitakit add ${kind} notes/${target || 'archive'}`;
  let plugin;
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
    if (!(await exists(moduleRoot)))
      throw new Error(
        `Plugin "${plugin}" does not exist. Create it with "bitakit add plugin ${plugin}".`,
      );
  }
  if (single) {
    if (name)
      throw new Error(
        `${kind === 'events' ? 'Events' : 'Settings'} are declared once per plugin in ${singleFile[kind]}: run "bitakit add ${kind}${project.kind === 'plugin' ? '' : ` ${plugin}`}" without a further name.`,
      );
  } else {
    if (!name) throw new Error(`Name the ${kind}, for example "${example}".`);
    name.split('/').forEach((segment) => validateName(segment, `${kind} name`));
  }
  const segments = name ? name.split('/') : [];
  const dotted = segments.join('.');
  // ui/pages/team/index.tsx serves /<plugin>/team, exactly as discovery derives it.
  const pageSegments = segments.at(-1) === 'index' ? segments.slice(0, -1) : segments;
  const pagePath = `/${plugin}${pageSegments.map((segment) => `/${segment}`).join('')}`;
  const files = {
    action: () => ({ [`actions/${name}.ts`]: actionFile(name) }),
    service: () => ({ [`services/${name}.ts`]: serviceFile(name) }),
    page: () => ({
      [`ui/pages/${name}.tsx`]: pageFile(plugin, pagePath, titleOf(pageSegments.at(-1) ?? plugin)),
    }),
    interceptor: () => ({ [`interceptors/${name}.ts`]: interceptorFile(plugin, name) }),
    config: () => ({ [`configs/${name}.ts`]: configFile(dotted) }),
    events: () => ({ 'events.ts': eventsFile(plugin) }),
    settings: () => ({ 'settings.ts': settingsFile(plugin) }),
    'settings-page': () => ({ 'ui/settings/page.tsx': settingsPageFile() }),
    slot: () => ({ [`ui/slots/${name}.tsx`]: slotFile(plugin, dotted) }),
    'slot-definition': () => ({ [`slots/${name}.ts`]: slotDefinitionFile() }),
    dialog: () => ({ [`ui/dialogs/${name}.tsx`]: dialogFile(plugin, dotted) }),
    provider: () => ({ [`ui/providers/${name}.tsx`]: providerFile(plugin, dotted) }),
  }[kind];
  const created = await writeNewFiles(moduleRoot, files());
  return {
    project,
    created,
    id: single ? `${plugin}.*` : `${plugin}.${dotted}`,
    path: kind === 'page' ? pagePath : undefined,
  };
}
