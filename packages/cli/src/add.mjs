import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exists, findProject } from './project.mjs';
import {
  actionFile,
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

/** `bitakit add plugin <name>`: a new folder under the app's plugin directory. */
export async function addPlugin(name, { cwd, minimal = false } = {}) {
  validateName(name, 'plugin name');
  const project = await findProject(cwd);
  if (project.kind !== 'app')
    throw new Error('This is a plugin package. Run "bitakit add plugin" inside an app.');
  if (!minimal && reserved.has(name))
    throw new Error(`"${name}" is reserved for app routes. Choose another plugin name.`);
  const root = path.join(project.pluginsDirectory, name);
  if (await exists(root)) throw new Error(`${root} already exists. Nothing was changed.`);
  const created = await writeNewFiles(root, pluginFiles(name, { minimal }));
  return { project, root, created, title: titleOf(name), path: minimal ? undefined : `/${name}` };
}

/**
 * `bitakit add action|service|page <plugin>/<name>` in an app, or `<name>` in a plugin package.
 * Contribution IDs come from the file path, so no registration is needed.
 */
export async function addContribution(kind, target, { cwd } = {}) {
  const project = await findProject(cwd);
  let plugin;
  let name = target;
  let moduleRoot;
  if (project.kind === 'plugin') {
    plugin = project.pluginId;
    moduleRoot = project.moduleRoot;
  } else {
    [plugin, name] = target?.includes('/') ? target.split('/') : [undefined, target];
    if (!plugin)
      throw new Error(`Name the plugin too, for example "bitakit add ${kind} notes/${target ?? 'archive'}".`);
    validateName(plugin, 'plugin name');
    moduleRoot = path.join(project.pluginsDirectory, plugin);
    if (!(await exists(moduleRoot)))
      throw new Error(`Plugin "${plugin}" does not exist. Create it with "bitakit add plugin ${plugin}".`);
  }
  validateName(name, `${kind} name`);
  const files = {
    action: () => ({ [`actions/${name}.ts`]: actionFile(name) }),
    service: () => ({ [`services/${name}.ts`]: serviceFile(name) }),
    page: () => ({ [`pages/${name}.tsx`]: pageFile(plugin, `/${plugin}/${name}`, titleOf(name)) }),
  }[kind];
  if (!files) throw new Error(`Unknown kind "${kind}". Use action, service or page.`);
  const created = await writeNewFiles(moduleRoot, files());
  return {
    project,
    created,
    id: kind === 'service' ? name : `${plugin}.${name}`,
    path: kind === 'page' ? `/${plugin}/${name}` : undefined,
  };
}
