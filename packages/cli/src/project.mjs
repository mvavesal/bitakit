import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadDiscoveryConfig } from '@bitakit/core/discovery';

/** The nearest package.json above `cwd`: the project root and its manifest, without reading any configuration. */
export async function findProjectRoot(cwd = process.cwd()) {
  let directory = path.resolve(cwd);
  for (;;) {
    const file = path.join(directory, 'package.json');
    const manifest = await readFile(file, 'utf8').then(JSON.parse, (error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (manifest) return { root: directory, manifest };
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error('No package.json found. Run this command inside a BitaKit app or plugin.');
    directory = parent;
  }
}

/**
 * The project around a working directory: an application (plugins live in its plugin
 * directory) or a standalone plugin package (contributions live in `src`).
 */
export async function findProject(cwd = process.cwd()) {
  const { root, manifest } = await findProjectRoot(cwd);
  return describeProject(root, manifest);
}

async function describeProject(root, manifest) {
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const framework = dependencies.next
    ? 'next'
    : dependencies['@tanstack/react-start'] || dependencies['@tanstack/react-router']
      ? 'tanstack'
      : undefined;
  const metadata = manifest.bitakit ?? manifest.foundation;
  // A package that publishes a plugin entry is itself the plugin.
  if (metadata?.plugin && !framework)
    return {
      kind: 'plugin',
      root,
      manifest,
      metadata,
      pluginId: metadata.id ?? packagePluginId(manifest.name),
      moduleRoot: path.join(root, 'src'),
    };
  // A configuration that cannot be evaluated (for example a 0.1 file importing a removed export)
  // still describes a project: commands that need it rethrow `configError`, doctor reports it.
  let loaded;
  let configError;
  try {
    // The CLI still reads the 0.1 file so doctor and migrate can report what it needs.
    loaded = await loadDiscoveryConfig(root, undefined, ['bitakit.config.ts', 'foundation.config.ts']);
  } catch (error) {
    configError = error;
    const legacy =
      (await exists(path.join(root, 'foundation.config.ts'))) &&
      !(await exists(path.join(root, 'bitakit.config.ts')));
    loaded = {
      config: {},
      file: path.join(root, legacy ? 'foundation.config.ts' : 'bitakit.config.ts'),
      legacy,
    };
  }
  const { config, file, legacy } = loaded;
  return {
    kind: 'app',
    root,
    manifest,
    framework,
    configFile: file,
    legacyConfig: legacy,
    configError,
    pluginsDirectory: path.resolve(root, config.plugins?.directory ?? './src/plugins'),
    appDirectory: path.resolve(root, config.directory ?? './src'),
  };
}

/** `@acme/bitakit-notes` → `notes`; the package manifest may set `bitakit.id` explicitly. */
export function packagePluginId(name = '') {
  return (
    name
      .replace(/^@[^/]+\//, '')
      .replace(/^bitakit-(plugin-)?/, '')
      .replace(/-plugin$/, '')
      .replace(/[^a-z0-9-]/g, '-') || 'plugin'
  );
}

export async function exists(file) {
  return access(file).then(
    () => true,
    () => false,
  );
}
