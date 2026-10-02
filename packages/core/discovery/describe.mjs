import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import { files, discoverEntries } from './entries.mjs';
import { pluginManifests } from './modules.mjs';
import { installedContributions } from './packages.mjs';

const kinds = ['actions', 'services', 'pages', 'views', 'configs', 'interceptors'];

/**
 * A read-only summary of what discovery registers: the app module, local plugins with their
 * contribution files, installed plugin packages and package styles. Contribution modules are
 * never executed; manifests and `foundation.config.ts` are trusted build code, as in generation.
 * Intended for tooling such as `bitakit doctor`; explicit manifest entry overrides are not applied.
 */
export async function describeFoundation(root) {
  root = await realpath(root);
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  const load = (file) =>
    readFile(file, 'utf8')
      .then(() => jiti.import(file, { default: true }))
      .catch((error) => {
        if (error.code === 'ENOENT' && error.path === file) return {};
        throw error;
      });
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');
  const config = await load(path.join(root, 'foundation.config.ts'));
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
  const contributions = async (base, list) =>
    Object.fromEntries(
      await Promise.all(
        kinds.map(async (kind) => [
          kind,
          (await discoverEntries(base, list, kind)).map((entry) => ({
            path: entry.path.join('.'),
            file: relative(entry.file),
          })),
        ]),
      ),
    );
  const appManifest = await load(path.join(appRoot, 'plugin.config.ts'));
  const app = {
    id: appManifest.id ?? '@foundation/app',
    directory: relative(appRoot),
    ...(await contributions(appRoot, await files(appRoot, moduleRoots))),
  };
  const plugins = [];
  for (const { manifestFile, id } of manifests) {
    const base = path.dirname(manifestFile);
    const manifest = { id: path.basename(base), ...(await load(manifestFile)), ...(id ? { id } : {}) };
    const own = await files(base, new Set([...moduleRoots].filter((item) => item !== base)));
    plugins.push({
      id: manifest.id,
      directory: relative(base),
      dependencies: manifest.dependencies ?? [],
      enabled: config.plugins?.overrides?.[manifest.id]?.enabled ?? config.plugins?.autoEnable ?? true,
      ...(await contributions(base, own)),
    });
  }
  const installed = await installedContributions(root, config.packages, jiti);
  return {
    root,
    pluginsDirectory: relative(directory),
    appDirectory: relative(appRoot),
    app,
    plugins,
    packages: installed.plugins,
    styles: installed.styles ?? [],
  };
}

/**
 * The contribution files of one module folder, such as a plugin package's `src`, using the same
 * conventions as app discovery. Paths are absolute; `setup` and `locales` are optional.
 */
export async function describeModule(directory) {
  const base = await realpath(directory);
  const list = await files(base);
  const entries = Object.fromEntries(
    await Promise.all(
      kinds.map(async (kind) => [
        kind,
        (await discoverEntries(base, list, kind)).map((entry) => ({
          path: entry.path.join('.'),
          file: entry.file,
        })),
      ]),
    ),
  );
  const setup = list.find((file) => file === path.join(base, 'setup.ts'));
  const locales = list.filter(
    (file) => path.dirname(file) === path.join(base, 'locales') && file.endsWith('.json'),
  );
  return { directory: base, ...entries, setup, locales };
}
