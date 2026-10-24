import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import { files, discoverEntries } from './entries.mjs';
import { parentDirectory, pluginManifests } from './modules.mjs';
import { installedContributions } from './packages.mjs';
import { detectFramework, loadDiscoveryConfig } from './generate.mjs';
import { describeDefinitions } from './definition-info.mjs';
import { layoutEntries } from './layouts.mjs';

const kinds = [
  'actions',
  'services',
  'pages',
  'slots',
  'slotDefinitions',
  'providers',
  'configs',
  'interceptors',
];

async function contributionsOf(
  base,
  list,
  relative,
  warnings,
  relativeTo = base,
  { app = false, entries = {} } = {},
) {
  const result = {};
  for (const kind of kinds) {
    const override = entries[kind];
    if (override === false) {
      result[kind] = [];
      continue;
    }
    let options = {};
    let paths = list;
    if (typeof override === 'string') {
      const target = path.resolve(base, override);
      const local = path.relative(base, target);
      if (local.startsWith('..') || path.isAbsolute(local))
        throw new Error(`Entry "${kind}" points outside the plugin: ${target}`);
      const actual = await realpath(target);
      if (actual !== target) throw new Error(`Symlink entry: ${target}`);
      paths = /\.tsx?$/.test(target) ? [target] : await files(target);
      options = /\.tsx?$/.test(target) ? { explicitFile: target } : { directory: target };
    }
    const found = await discoverEntries(base, paths, kind, {
      ...options,
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
  const settings = list.find((file) => file === path.join(base, 'settings.ts'));
  result.settings = settings ? [{ path: '', file: relative(settings) }] : [];
  const settingsPage = list.find((file) => file === path.join(base, 'ui', 'settings', 'page.tsx'));
  if (settingsPage) result.settingsPage = relative(settingsPage);
  const layouts = layoutEntries(list, path.join(base, ...(app ? ['layouts'] : ['ui', 'layouts'])));
  if (app || layouts.length)
    result.layouts = layouts.map(({ family, variant, file }) => ({
      family,
      variant,
      file: relative(file),
    }));
  return result;
}

/**
 * A read-only summary of what discovery registers: the app module, local plugins with their
 * contribution files, installed plugin packages, package styles and the warnings generation
 * would print. Contribution modules are never executed.
 */
export async function describeBitaKit(root) {
  root = await realpath(root);
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');
  const warnings = [];
  const { config } = await loadDiscoveryConfig(root, jiti);
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
  const manifestOf = async ({ manifestFile, id }) => ({
    id: path.basename(path.dirname(manifestFile)),
    ...(await load(manifestFile)),
    ...(id ? { id } : {}),
  });
  // Every plugin's ID first, so a nested child can name the plugin folder around it.
  const idByDirectory = new Map();
  for (const entry of manifests)
    idByDirectory.set(path.dirname(entry.manifestFile), (await manifestOf(entry)).id);
  for (const entry of manifests) {
    const base = path.dirname(entry.manifestFile);
    const manifest = await manifestOf(entry);
    const own = await files(base, new Set([...moduleRoots].filter((item) => item !== base)));
    const parent = manifest.parent ?? idByDirectory.get(parentDirectory(base, moduleRoots));
    plugins.push({
      id: manifest.id,
      directory: relative(base),
      ...(parent ? { parent } : {}),
      // The parent is a lifecycle dependency, as at runtime.
      dependencies: [...new Set([...(manifest.dependencies ?? []), ...(parent ? [parent] : [])])],
      enabled:
        config.plugins?.overrides?.[manifest.id]?.enabled ?? config.plugins?.autoEnable ?? true,
      ...(await contributionsOf(base, own, relative, warnings, root, {
        entries: manifest.entries,
      })),
    });
  }
  const installed = await installedContributions(root, config.packages, jiti);
  const rootManifest = await readFile(path.join(root, 'package.json'), 'utf8').then(
    JSON.parse,
    () => ({}),
  );
  const slotDeclarations = [...(installed.slotDeclarations ?? [])];
  const unresolvedSlots = [...(installed.unresolvedSlots ?? [])];
  for (const module of [app, ...plugins.filter((plugin) => plugin.enabled)]) {
    const result = await describeDefinitions(
      module.slotDefinitions.map((entry) => ({ ...entry, file: path.join(root, entry.file) })),
      {
        helper: 'defineSlot',
        moduleId: module === app ? '' : module.id,
        properties: ['accepts', 'policy'],
      },
    );
    slotDeclarations.push(
      ...result.definitions.map((item) => ({
        ...item,
        file: relative(item.file),
        plugin: module.id,
        policy: item.policy ?? 'list',
      })),
    );
    unresolvedSlots.push(...result.unresolved.map(relative));
  }
  return {
    root,
    framework: config.framework ?? detectFramework(rootManifest),
    pluginsDirectory: relative(directory),
    appDirectory: relative(appRoot),
    app,
    plugins,
    packages: installed.plugins,
    catalogPackages: installed.plugins.filter((entry) =>
      config.catalog?.includes(installed.pluginPackages?.[entry]?.name),
    ),
    installedPackages: installed.packages,
    styles: installed.styles ?? [],
    slotDeclarations,
    unresolvedSlots,
    /** Slot names layouts render: `@bitakit/ui`'s app bar, package manifests and `bitakit.config.ts`. */
    slots: [
      ...new Set([
        ...(installed.packages.includes('@bitakit/ui') ? ['app-bar.end'] : []),
        ...(installed.slots ?? []),
        ...(config.slots ?? []),
      ]),
    ],
    /** `choose` of bitakit.config.ts: the occupant the app picks for each `single` slot. */
    choose: config.choose ?? {},
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
