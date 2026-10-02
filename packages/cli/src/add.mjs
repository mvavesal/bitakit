import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exists, findProject } from './project.mjs';
import {
  actionFile,
  configFile,
  eventsFile,
  interceptorFile,
  pageFile,
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
  const created = await writeNewFiles(root, pluginFiles(name, { minimal }));
  return { project, root, created, title: titleOf(name), path: minimal ? undefined : `/${name}` };
}

export const contributionKinds = ['action', 'service', 'page', 'interceptor', 'config', 'events'];

/**
 * `bitakit add <kind> <plugin>/<name>` in an app, or `<name>` in a plugin package. Nested names
 * such as `notes/team/invite` create `actions/team/invite.ts` with the ID `notes.team.invite`.
 * `events` takes only the plugin: a plugin declares its events once in `events.ts`.
 */
export async function addContribution(kind, target, { cwd } = {}) {
  if (!contributionKinds.includes(kind))
    throw new Error(`Unknown kind "${kind}". Use ${contributionKinds.join(', ')}.`);
  const project = await configuredProject(cwd);
  const example =
    kind === 'events'
      ? 'bitakit add events notes'
      : `bitakit add ${kind} notes/${target || 'archive'}`;
  let plugin;
  let name = target ?? '';
  let moduleRoot;
  if (project.kind === 'plugin') {
    plugin = project.pluginId;
    moduleRoot = project.moduleRoot;
    // The package is the plugin; naming it is allowed but not needed.
    if (kind === 'events' && name === plugin) name = '';
  } else {
    const slash = name.indexOf('/');
    [plugin, name] =
      slash >= 0
        ? [name.slice(0, slash), name.slice(slash + 1)]
        : kind === 'events'
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
  if (kind === 'events') {
    if (name)
      throw new Error(
        `Events are declared once per plugin in events.ts: run "bitakit add events${project.kind === 'plugin' ? '' : ` ${plugin}`}" without a further name.`,
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
  }[kind];
  const created = await writeNewFiles(moduleRoot, files());
  return {
    project,
    created,
    id: kind === 'events' ? `${plugin}.*` : `${plugin}.${dotted}`,
    path: kind === 'page' ? pagePath : undefined,
  };
}
