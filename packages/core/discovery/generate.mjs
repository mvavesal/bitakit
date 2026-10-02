import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { files, discoverEntries, contributionKindSpecs } from './entries.mjs';
import { createJiti } from 'jiti';
import { installedContributions } from './packages.mjs';
import { pluginManifests } from './modules.mjs';
const quote = JSON.stringify;
async function writeChanged(file, content) {
  if ((await readFile(file, 'utf8').catch(() => null)) !== content) await writeFile(file, content);
}
/** Only static imports are generated. Services/actions are never executed by discovery. */
export async function generateFoundation(root) {
  root = await realpath(root);
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false,
  });
  const configFile = path.join(root, 'foundation.config.ts');
  // Missing customization is the default case; errors inside an existing config must propagate.
  const config = await readFile(configFile, 'utf8')
    .then(() => jiti.import(configFile, { default: true }))
    .catch((error) => {
      if (error.code === 'ENOENT' && error.path === configFile) return {};
      throw error;
    });
  const directory = path.resolve(root, config.plugins?.directory ?? './src/plugins');
  const installed = await installedContributions(root, config.packages, jiti);
  const output = path.join(root, '.foundation');
  await mkdir(output, { recursive: true });
  const roots = pluginManifests(directory, await files(directory));
  // Plugins outside the plugin directory, such as the source of a plugin package in its playground.
  const included = Object.entries(config.plugins?.include ?? {}).map(([id, folder]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Invalid included plugin ID: ${id}`);
    const base = path.resolve(root, folder);
    return { manifestFile: path.join(base, 'plugin.config.ts'), id };
  });
  const modules = [...roots.map((manifestFile) => ({ manifestFile })), ...included];
  const imports = [];
  const definitions = [];
  const serviceTypes = [];
  const publicServiceTypes = [];
  const configTypes = [];
  const allMessages = {};
  const pluginIds = new Set();
  let serial = 0;
  const importFile = (file) => {
    const name = `entry${serial++}`;
    let relative = path
      .relative(output, file)
      .replaceAll(path.sep, '/')
      .replace(/\.tsx?$/, '');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    imports.push(`import ${name} from ${quote(relative)};`);
    return name;
  };
  const conventions = config.conventions !== false;
  // Explicit discovery configuration replaces package defaults by contribution kind.
  const kinds = contributionKindSpecs([
    ...new Map(
      [...contributionKindSpecs(installed.kinds), ...contributionKindSpecs(config.kinds)].map(
        (kind) => [kind.name, kind],
      ),
    ).values(),
  ]);
  const normalizers = new Map();
  const contributionTypes = new Map();
  /** Emits `{ kind: normalize([files], moduleId) }` for kinds with files; normalizers run at import time. */
  const contributions = (entriesByKind, moduleId) => {
    const parts = [];
    kinds.forEach((kind, index) => {
      const entries = entriesByKind[index];
      if (!entries.length) return;
      if (!normalizers.has(kind.name)) {
        const alias = `normalize${index}`;
        imports.push(`import { ${kind.normalize} as ${alias} } from ${quote(kind.from)};`);
        normalizers.set(kind.name, alias);
      }
      const names = fileEntries(entries);
      if (kind.types) {
        if (!contributionTypes.has(kind.name)) {
          imports.push(
            `import type { ${kind.types.entry} as KindEntry${index} } from ${quote(kind.from)};`,
          );
          contributionTypes.set(kind.name, { kind, index, entries: [] });
        }
        contributionTypes
          .get(kind.name)
          .entries.push(
            ...names.map((name) => `KindEntry${index}<typeof ${name}, ${quote(moduleId)}>`),
          );
      }
      parts.push(
        `${quote(kind.name)}: ${normalizers.get(kind.name)}([${names}], ${quote(moduleId)})`,
      );
    });
    return `{ ${parts.join(', ')} }`;
  };
  const actionTypes = [];
  const moduleRoots = new Set(modules.map((module) => path.dirname(module.manifestFile)));
  const appRoot = path.resolve(root, config.directory ?? './src');
  const appManifestFile = path.join(appRoot, 'plugin.config.ts');
  const appManifest = await readFile(appManifestFile, 'utf8')
    .then(() => jiti.import(appManifestFile, { default: true }))
    .catch((error) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    });
  const appId = appManifest.id ?? '@foundation/app';
  if (appId !== '@foundation/app' && !/^[a-z][a-z0-9-]*$/.test(appId))
    throw new Error(`Invalid app module ID: ${appId}`);
  pluginIds.add(appId);
  const enabledModuleIds = new Set([appId]);
  const appFiles = await files(appRoot, moduleRoots);
  const fileEntries = (entries) =>
    entries.map((entry) => {
      const imported = importFile(entry.file);
      const name = `file${serial++}`;
      imports.push(
        // Project-relative sources make runtime diagnostics point at the actual file.
        `const ${name} = discoveredFile(${imported}, ${quote(entry.path.join('.'))}, ${quote(path.relative(root, entry.file).split(path.sep).join('/'))});`,
      );
      return name;
    });
  const emit = (kind, entries, moduleId = '') => {
    const names = fileEntries(entries);
    if (kind === 'actions')
      for (const name of names)
        actionTypes.push(
          `DiscoveredActionEntry<typeof ${name}, ${quote(moduleId)}, ${conventions}>`,
        );
    if (kind === 'services') {
      for (const name of names) {
        serviceTypes.push(`DiscoveredServiceEntry<typeof ${name}, ${quote(moduleId)}>`);
        publicServiceTypes.push(`DiscoveredPublicServiceEntry<typeof ${name}>`);
      }
    }
    if (kind === 'configs')
      configTypes.push(
        `${quote(moduleId)}: ${names.map((name) => `DiscoveredConfigEntry<typeof ${name}>`).join(' & ') || '{}'};`,
      );
    const fn = {
      actions: 'discoverActions',
      services: 'discoverServices',
      interceptors: 'discoverInterceptors',
      configs: 'discoverConfig',
    }[kind];
    return `${fn}([${names}]${kind === 'actions' ? `, ${quote(moduleId)}, ${conventions}` : kind === 'services' ? `, ${quote(moduleId)}` : ''})`;
  };
  const appEntries = async (kind) => {
    const selected = config[kind];
    if (selected === false) return [];
    if (selected?.directory) {
      const directory = path.resolve(root, selected.directory);
      return discoverEntries(appRoot, await files(directory, moduleRoots), kind, { directory });
    }
    return discoverEntries(appRoot, appFiles, kind);
  };
  const appContributions = contributions(
    await Promise.all(kinds.map((kind) => discoverEntries(appRoot, appFiles, kind))),
    appId,
  );
  const appPages = (await appEntries('pages')).map((entry) => importFile(entry.file));
  const appViews = (await appEntries('views')).map((entry) => importFile(entry.file));
  const appSetupFile = appFiles.find((file) => file === path.join(appRoot, 'setup.ts'));
  const appSetup = appSetupFile ? importFile(appSetupFile) : 'undefined';
  const appActions = emit('actions', await appEntries('actions'), appManifest.id ?? '');
  const appServices = emit('services', await appEntries('services'), appManifest.id ?? '');
  const appConfig = emit('configs', await appEntries('configs'), appId);
  let interceptorEntries = await appEntries('interceptors');
  if (config.interceptors?.enabled !== undefined) {
    const enabled = config.interceptors.enabled;
    if (new Set(enabled).size !== enabled.length) throw new Error('Duplicate enabled interceptor.');
    interceptorEntries = enabled.map((id) => {
      const entry = interceptorEntries.find((entry) => entry.path.join('.') === id);
      if (!entry) throw new Error(`Unknown interceptor "${id}".`);
      return entry;
    });
  }
  const interceptors = emit('interceptors', interceptorEntries);
  const providerEntries = await appEntries('providers');
  const enabledProviders = config.providers?.enabled ?? [];
  if (new Set(enabledProviders).size !== enabledProviders.length)
    throw new Error('Duplicate enabled provider.');
  const providers = enabledProviders.map((id) => {
    const entry = providerEntries.find((entry) => entry.path.join('.') === id);
    if (!entry) throw new Error(`Unknown provider "${id}".`);
    return importFile(entry.file);
  });
  for (const { manifestFile, id } of modules) {
    const base = path.dirname(manifestFile);
    const overrides = await readFile(manifestFile, 'utf8')
      .then(() => jiti.import(manifestFile, { default: true }))
      .catch((error) => {
        if (error.code === 'ENOENT' && error.path === manifestFile) return {};
        throw error;
      });
    const manifest = { id: path.basename(base), ...overrides, ...(id ? { id } : {}) };
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.id) || pluginIds.has(manifest.id))
      throw new Error(`Invalid or duplicate plugin ID: ${manifest.id}`);
    pluginIds.add(manifest.id);
    const enabled =
      config.plugins?.overrides?.[manifest.id]?.enabled ?? config.plugins?.autoEnable ?? true;
    // A package's sources usually sit in src/, next to its package.json.
    const readPackage = (folder) =>
      readFile(path.join(folder, 'package.json'), 'utf8')
        .then(JSON.parse)
        .catch((error) => {
          if (error.code === 'ENOENT') return undefined;
          throw error;
        });
    const packageInfo =
      (await readPackage(base)) ?? (id ? await readPackage(path.dirname(base)) : undefined) ?? {};
    const metadata = {};
    for (const key of ['name', 'version', 'description', 'author', 'homepage', 'bugs', 'license']) {
      const value = manifest.metadata?.[key] ?? packageInfo[key];
      if (value !== undefined) metadata[key] = value;
    }

    const resolveEntry = async (name, fallback) => {
      const override = manifest.entries?.[name];
      if (override === false) return [];
      const target = path.resolve(base, override ?? fallback);
      const relative = path.relative(base, target);
      if (relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`Entry outside plugin: ${name}`);
      const actual = await realpath(target).catch((error) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (!actual) {
        if (override) throw new Error(`Missing explicit entry: ${target}`);
        return [];
      }
      if (actual !== target) throw new Error(`Symlink entry: ${target}`);
      return /\.tsx?$/.test(target) ? [target] : files(target);
    };
    const moduleFiles = await files(
      base,
      new Set([...moduleRoots].filter((item) => item !== base)),
    );
    const entriesFor = async (kind) => {
      const override = manifest.entries?.[kind];
      if (override === false) return [];
      if (override) {
        const paths = await resolveEntry(kind, kind);
        const target = path.resolve(base, override);
        return discoverEntries(
          base,
          paths,
          kind,
          /\.tsx?$/.test(target) ? { explicitFile: target } : { directory: target },
        );
      }
      return discoverEntries(base, moduleFiles, kind);
    };
    const entriesForKind = async (kind) => {
      const override = manifest.entries?.[kind.name];
      if (override === false) return [];
      if (override) {
        const paths = await resolveEntry(kind.name, kind.directory);
        const target = path.resolve(base, override);
        return discoverEntries(
          base,
          paths,
          kind,
          /\.tsx?$/.test(target) ? { explicitFile: target } : { directory: target },
        );
      }
      return discoverEntries(base, moduleFiles, kind);
    };
    const setupFiles = await resolveEntry('setup', 'setup.ts');
    const viewFiles = (await entriesFor('views')).map((entry) => entry.file);
    const pageFiles = (await entriesFor('pages')).map((entry) => entry.file);
    if (!enabled) continue;
    enabledModuleIds.add(manifest.id);
    const actions = emit('actions', await entriesFor('actions'), manifest.id);
    const services = emit('services', await entriesFor('services'), manifest.id);
    const pluginConfig = emit('configs', await entriesFor('configs'), manifest.id);
    const pluginInterceptors = emit('interceptors', await entriesFor('interceptors'));
    const pages = pageFiles.map((file) => importFile(file));
    const views = viewFiles.map((file) => importFile(file));
    const setup = setupFiles[0] ? importFile(setupFiles[0]) : 'undefined';
    const pluginContributions = contributions(
      await Promise.all(kinds.map((kind) => entriesForKind(kind))),
      manifest.id,
    );
    definitions.push(
      `{ id: ${quote(manifest.id)}, metadata: ${quote(metadata)}, dependencies: ${quote(manifest.dependencies ?? [])}, actions: ${actions}, services: ${services}, config: ${pluginConfig}, interceptors: ${pluginInterceptors}, views: [${views}], pages: [${pages}], setup: ${setup}, contributions: ${pluginContributions} }`,
    );
    for (const file of await resolveEntry('locales', 'locales')) {
      if (!file.endsWith('.json')) continue;
      const locale = path.basename(file, '.json');
      const messages = JSON.parse(await readFile(file, 'utf8'));
      if (Object.keys(messages).some((key) => key !== manifest.id))
        throw new Error(`Locale keys must use plugin namespace "${manifest.id}".`);
      (allMessages[locale] ??= {})[manifest.id] = messages[manifest.id];
    }
  }
  const header = '// Generated by SaaS Foundation. Do not edit.\n';
  await writeChanged(
    path.join(output, 'plugins.ts'),
    `${header}${[...contributionTypes.values()].map(({ kind, index, entries }) => `type KindMap${index} = ${entries.join(' & ')}; declare module ${quote(kind.from)} { interface ${kind.types.map} extends KindMap${index} {} }`).join('\n')}
${imports.join('\n')}\nimport { ${imports.some(entry => entry.includes('= discoveredFile(')) ? 'discoveredFile, ' : ''}discoverActions, discoverServices, discoverInterceptors, discoverConfig, ${actionTypes.length ? 'type DiscoveredActionEntry, ' : ''}${serviceTypes.length ? 'type DiscoveredServiceEntry, ' : ''}${publicServiceTypes.length ? 'type DiscoveredPublicServiceEntry, ' : ''}${configTypes.some(entry => entry.includes('DiscoveredConfigEntry')) ? 'type DiscoveredConfigEntry, ' : ''}type FoundationConfig } from '@bitakit/core';\ntype DiscoveredServices = ${serviceTypes.join(' & ') || '{}'};\ntype DiscoveredPublicServices = ${publicServiceTypes.join(' & ') || '{}'};\ntype DiscoveredActions = ${actionTypes.join(' & ') || '{}'};\ndeclare module '@bitakit/core' { interface PublicServiceMap extends DiscoveredPublicServices {} interface ServiceMap extends DiscoveredServices, DiscoveredPublicServices {} interface ActionMap extends DiscoveredActions {} interface ConfigMap { ${configTypes.join(' \n')} } }\nexport const foundationConfig = { appId: ${quote(appId)}, metadata: ${quote(appManifest.metadata ?? {})}, dependencies: ${quote(appManifest.dependencies ?? [])}, pages: [${appPages}], views: [${appViews}], setup: ${appSetup}, groups: ${quote(config.groups ?? [])}, actionOverrides: ${quote((config.actions && config.actions.overrides) || {})}, config: ${appConfig}, configOverrides: ${quote(Object.fromEntries(Object.entries(config.configOverrides ?? {}).filter(([id]) => !pluginIds.has(id) || enabledModuleIds.has(id))))}, services: ${appServices}, interceptors: ${interceptors}, providers: [${providers}], actions: ${appActions}, contributions: ${appContributions}, plugins: [${definitions.join(',\n')}] } satisfies FoundationConfig;\n`,
  );
  await writeChanged(
    path.join(output, 'messages.json'),
    JSON.stringify(allMessages, null, 2) + '\n',
  );
  // One stylesheet for every installed package that ships styles; apps import only this file.
  await writeChanged(
    path.join(output, 'styles.css'),
    `/* Generated by BitaKit. Do not edit. Styles of installed packages, theme last. */\n${(installed.styles ?? []).map((specifier) => `@import ${quote(specifier)};`).join('\n')}\n`,
  );
  const configured = Object.keys(installed.configurations ?? {}).length > 0;
  const watched = included.map((module) => path.dirname(module.manifestFile));
  const pluginFactories = installed.plugins.map((specifier, index) => {
    const configPath = installed.configurations?.[specifier];
    return `packagePlugin${index}(${configPath ? `options.get(${quote(configPath)}, {})` : ''})`;
  });
  await writeChanged(
    path.join(output, 'app.ts'),
    `${header}
import { foundationConfig } from './plugins';
${installed.plugins.map((specifier, index) => `import packagePlugin${index} from ${quote(specifier)};`).join('\n')}
import { ${configured ? 'ConfigService, type FoundationConfig, ' : ''}type PublicServicesOf } from '@bitakit/core';
type InstalledPlugins = [${installed.plugins.map((_, index) => `ReturnType<typeof packagePlugin${index}>`).join(', ')}];
type InstalledPublicServices = PublicServicesOf<InstalledPlugins>;
declare module '@bitakit/core' { interface PublicServiceMap extends InstalledPublicServices {} interface ServiceMap extends InstalledPublicServices {} }
/** Factories describe plugins per provider instance; runtime creation and cleanup stay in Core. */
export function createFoundationConfig() {
  ${configured ? `const { appId = '@foundation/app', config, configOverrides = {} }: FoundationConfig = foundationConfig;
  const options = new ConfigService([{ id: appId, config }], {
    [appId]: configOverrides[appId] ?? {},
  }).plugin(appId);` : ''}
  return { ...foundationConfig, plugins: [...foundationConfig.plugins, ${pluginFactories.join(', ')}] };
}
`,
  );
  return { included: watched };
}
