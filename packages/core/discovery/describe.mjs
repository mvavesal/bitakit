import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import { files, discoverEntries } from './entries.mjs';
import { pluginManifests } from './modules.mjs';
import { installedContributions } from './packages.mjs';
import { detectFramework, loadDiscoveryConfig } from './generate.mjs';

const kinds = ['actions', 'services', 'pages', 'slots', 'providers', 'configs', 'interceptors'];

async function contributionsOf(
  base,
  list,
  relative,
  warnings,
  relativeTo = base,
  { app = false } = {},
) {
  const result = {};
  for (const kind of kinds) {
    const found = await discoverEntries(base, list, kind, {
      relativeTo,
      legacy: !(app && kind === 'providers'),
    });
    warnings.push(...found.warnings);
    result[kind] = found.entries.map((entry) => ({
      path: entry.path.join('.'),
      file: relative(entry.file),
    }));
  }
  const events = list.find((file) => file === path.join(base, 'events.ts'));
  result.events = events ? [{ path: '', file: relative(events) }] : [];
  return result;
}

/**
 * A read-only summary of what discovery registers: the app module, local plugins with their
 * contribution files, installed plugin packages, package styles and the warnings generation
 * would print. Contribution modules are never executed.
 */
export async function describeFoundation(root) {
  root = await realpath(root);
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');
  const warnings = [];
  const { config, legacy } = await loadDiscoveryConfig(root, jiti);
  if (legacy)
    warnings.push(
      'foundation.config.ts is deprecated: rename it to bitakit.config.ts (run "bitakit migrate").',
    );
  const directory = path.resolve(root, config.plugins?.directory ?? './src/plugins');
  const appRoot = path.resolve(root, config.directory ?? './src');
  const included = Object.entries(config.plugins?.include ?? {}).map(([id, folder]) => ({
    manifestFile: path.join(path.resolve(root, folder), 'plugin.config.ts'),
    id,
  }));
  const manifests = [
    ...pluginManifests(directory, await files(directory)).map((manifestFile) => ({ manifestFile })),
    ...included,
  ];
  const moduleRoots = new Set(manifests.map(({ manifestFile }) => path.dirname(manifestFile)));
  const load = (file) =>
    readFile(file, 'utf8')
      .then(() => jiti.import(file, { default: true }))
      .catch((error) => {
        if (error.code === 'ENOENT' && error.path === file) return {};
        throw error;
      });
  const appManifest = await load(path.join(appRoot, 'plugin.config.ts'));
  const appFiles = (await files(appRoot, moduleRoots)).filter(
    (file) => !/[\\/]bitakit\.gen\./.test(file),
  );
  const app = {
    id: appManifest.id ?? 'app',
    directory: relative(appRoot),
    ...(await contributionsOf(appRoot, appFiles, relative, warnings, root, { app: true })),
  };
  const plugins = [];
  for (const { manifestFile, id } of manifests) {
    const base = path.dirname(manifestFile);
    const manifest = {
      id: path.basename(base),
      ...(await load(manifestFile)),
      ...(id ? { id } : {}),
    };
    const own = await files(base, new Set([...moduleRoots].filter((item) => item !== base)));
    plugins.push({
      id: manifest.id,
      directory: relative(base),
      dependencies: manifest.dependencies ?? [],
      enabled:
        config.plugins?.overrides?.[manifest.id]?.enabled ?? config.plugins?.autoEnable ?? true,
      ...(await contributionsOf(base, own, relative, warnings, root)),
    });
  }
  const installed = await installedContributions(root, config.packages, jiti);
  const rootManifest = await readFile(path.join(root, 'package.json'), 'utf8').then(
    JSON.parse,
    () => ({}),
  );
  return {
    root,
    framework: config.framework ?? detectFramework(rootManifest),
    pluginsDirectory: relative(directory),
    appDirectory: relative(appRoot),
    app,
    plugins,
    packages: installed.plugins,
    installedPackages: installed.packages,
    styles: installed.styles ?? [],
    warnings,
  };
}

/** The contribution files of one module folder, such as a plugin package's `src`, using app conventions. */
export async function describeModule(directory) {
  const base = await realpath(directory);
  const list = await files(base);
  const warnings = [];
  const entries = await contributionsOf(base, list, (file) => file, warnings);
  const setup = list.find((file) => file === path.join(base, 'setup.ts'));
  const locales = list.filter(
    (file) => path.dirname(file) === path.join(base, 'locales') && file.endsWith('.json'),
  );
  return { directory: base, ...entries, setup, locales, warnings };
}
