import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';

/**
 * The project around a working directory: an application (plugins live in its plugin
 * directory) or a standalone plugin package (contributions live in `src`).
 */
export async function findProject(cwd = process.cwd()) {
  let directory = path.resolve(cwd);
  for (;;) {
    const file = path.join(directory, 'package.json');
    const manifest = await readFile(file, 'utf8').then(JSON.parse, (error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (manifest) return describeProject(directory, manifest);
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error('No package.json found. Run this command inside a BitaKit app or plugin.');
    directory = parent;
  }
}

async function describeProject(root, manifest) {
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const framework = dependencies.next
    ? 'next'
    : dependencies['@tanstack/react-start'] || dependencies['@tanstack/react-router']
      ? 'tanstack'
      : undefined;
  // A package that publishes a Foundation plugin entry is itself the plugin.
  if (manifest.foundation?.plugin && !framework)
    return {
      kind: 'plugin',
      root,
      manifest,
      pluginId: manifest.foundation.id ?? packagePluginId(manifest.name),
      moduleRoot: path.join(root, 'src'),
    };
  const config = await loadConfig(root);
  return {
    kind: 'app',
    root,
    manifest,
    framework,
    pluginsDirectory: path.resolve(root, config.plugins?.directory ?? './src/plugins'),
    appDirectory: path.resolve(root, config.directory ?? './src'),
  };
}

/** `@acme/bitakit-notes` → `notes`; the package manifest may set `foundation.id` explicitly. */
export function packagePluginId(name = '') {
  return (
    name
      .replace(/^@[^/]+\//, '')
      .replace(/^bitakit-(plugin-)?/, '')
      .replace(/-plugin$/, '')
      .replace(/[^a-z0-9-]/g, '-') || 'plugin'
  );
}

async function loadConfig(root) {
  const file = path.join(root, 'foundation.config.ts');
  if (!(await exists(file))) return {};
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  return jiti.import(file, { default: true });
}

export async function exists(file) {
  return access(file).then(
    () => true,
    () => false,
  );
}
