import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { validatePackageStyles, resolveStylesheet } from './styles.mjs';
import { staticPluginId } from './package-identity.mjs';
import { packageOrigin } from './plugin-metadata.mjs';

/**
 * Reads opt-in metadata (`bitakit` in package.json, `foundation` as the older name) from direct
 * dependencies and, transitively, from the plugin packages they depend on, so a plugin package
 * activates the plugin packages it depends on. Never imports client code in Node.
 */
export async function installedContributions(
  root,
  selection,
  jiti,
  { metadataOnly = false, auditStyles = !metadataOnly } = {},
) {
  if (selection === false)
    return {
      plugins: [],
      kinds: [],
      configurations: {},
      dependencies: {},
      styles: [],
      packages: [],
      slots: [],
    };
  const manifestFile = path.join(root, 'package.json');
  const manifest = await readFile(manifestFile, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    });
  const pluginPackages = {};
  const imports = {};
  const plugins = [];
  const kinds = [];
  const configurations = {};
  const dependencies = {};
  const stylesheets = [];
  const packages = [];
  const slots = [];
  const slotDeclarations = [];
  const unresolvedSlots = [];
  const warnings = [];
  const visited = new Set();
  const queue = Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })
    .sort()
    .map((name) => ({ name, from: manifestFile }));
  while (queue.length) {
    const { name, from } = queue.shift();
    if (
      Object.entries(selection ?? {}).some(
        ([key, enabled]) => key.toLowerCase() === name.toLowerCase() && enabled === false,
      )
    )
      continue;
    let file;
    try {
      file = createRequire(from).resolve(`${name}/package.json`);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        // Inspect only to diagnose an inaccessible opt-in manifest, never to bypass exports.
        for (const directory of createRequire(from).resolve.paths(name) ?? []) {
          const candidate = await readFile(path.join(directory, name, 'package.json'), 'utf8')
            .then(JSON.parse)
            .catch((failure) => {
              if (failure.code !== 'ENOENT') throw failure;
            });
          if (candidate?.bitakit || candidate?.foundation)
            throw new Error(
              `BitaKit package "${name}" cannot expose its discovery metadata. Export "./package.json" from its package.json (${error.code}).`,
            );
          if (candidate) break;
        }
        continue;
      }
      throw error;
    }
    file = await realpath(file);
    if (visited.has(file)) continue;
    visited.add(file);
    const installed = JSON.parse(await readFile(file, 'utf8'));
    const rootFile = await Promise.resolve()
      .then(() => createRequire(manifestFile).resolve(`${name}/package.json`))
      .then(realpath)
      .catch(() => null);
    const direct = rootFile === file;
    const location = path.relative(root, file).split(path.sep).join('/');
    const metadata = installed.bitakit ?? installed.foundation;
    if (!metadata) continue;
    if (!packages.includes(name)) packages.push(name);
    const specifier = (entry) => {
      if (
        typeof entry !== 'string' ||
        !/^\.\/[\w./-]+$/.test(entry) ||
        entry.split('/').includes('..')
      )
        throw new Error(`Invalid BitaKit export in package "${name}".`);
      return `${name}/${entry.slice(2)}`;
    };
    const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
    if (metadata.plugin) {
      const publicEntry = specifier(metadata.plugin);
      const plugin = direct ? publicEntry : `${name}@${installed.version ?? '?'}:${location}`;
      plugins.push(plugin);
      pluginPackages[plugin] = {
        name: (installed.name ?? name).toLowerCase(),
        version: installed.version,
        origin: packageOrigin('package', installed, warnings, `${name}/package.json`),
      };
      // `bitakit build` emits this optional, derived sidecar. Never execute a client entry in Node.
      let entryFile;
      try {
        entryFile = createRequire(from).resolve(publicEntry);
      } catch (error) {
        if (!['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code))
          throw error;
      }
      imports[plugin] = direct ? publicEntry : entryFile;
      if (!direct && !entryFile)
        throw new Error(`Cannot resolve BitaKit entry "${publicEntry}" from ${location}.`);
      const slotInfo =
        entryFile && /\.[cm]?[jt]sx?$/.test(entryFile)
          ? await readFile(entryFile.replace(/\.[cm]?[jt]sx?$/, '.slots.json'), 'utf8')
              .then(JSON.parse)
              .catch((error) => {
                if (error.code !== 'ENOENT') throw error;
              })
          : undefined;
      const pluginId = staticPluginId(
        `${installed.name ?? name}@${installed.version ?? '?'}`,
        metadata,
        slotInfo,
      );
      pluginPackages[plugin].pluginId = pluginId;
      pluginPackages[plugin].origin.pluginId = pluginId;
      if (slotInfo?.version === 1) {
        slotDeclarations.push(
          ...slotInfo.definitions.map((item) => ({ ...item, file: `${name}/${item.file}` })),
        );
        unresolvedSlots.push(...slotInfo.unresolved.map((file) => `${name}/${file}`));
      }
      if (metadata.configuration) configurations[plugin] = metadata.configuration;
      // Plugin IDs the package plugin depends on at runtime; the generator adds them to the plugin.
      const ids = list(metadata.dependencies);
      for (const id of ids)
        if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id))
          throw new Error(
            `Invalid plugin dependency in the bitakit manifest of package "${name}".`,
          );
      if (ids.length) dependencies[plugin] = [...new Set(ids)];
    }
    stylesheets.push({
      name,
      manifestFile: file,
      manifest: installed,
      direct,
      dependencies: Object.keys({
        ...installed.dependencies,
        ...installed.peerDependencies,
      }).sort(),
      styles: list(metadata.styles).map(specifier),
      theme: list(metadata.theme).map(specifier),
    });
    // Layout packages declare the slots they render, so SlotMap and doctor know them.
    for (const slot of list(metadata.slots)) {
      if (typeof slot !== 'string' || !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/.test(slot))
        throw new Error(`Invalid slot name in the bitakit manifest of package "${name}".`);
      if (!slots.includes(slot)) slots.push(slot);
    }
    if (metadata.discovery && !metadataOnly) {
      const discover = await jiti.import(
        createRequire(from).resolve(specifier(metadata.discovery)),
        { default: true },
      );
      kinds.push(...discover());
    }
    // Plugin packages activate the plugin packages they depend on.
    for (const dependency of Object.keys({
      ...installed.dependencies,
      ...installed.peerDependencies,
    }).sort())
      queue.push({ name: dependency, from: file });
  }
  const styleSources = auditStyles ? await validatePackageStyles(stylesheets) : [];
  return {
    plugins,
    pluginPackages,
    imports,
    kinds,
    configurations,
    dependencies,
    styles: orderStyles(stylesheets),
    styleSources,
    packages,
    slots,
    slotDeclarations,
    unresolvedSlots,
    warnings,
  };
}

/** Package styles after the styles of the packages they depend on; theme files come last. */
function orderStyles(packages) {
  const byFile = new Map(packages.map((entry) => [entry.manifestFile, entry]));
  const ordered = [];
  const visit = (entry, trail = new Set()) => {
    if (ordered.includes(entry) || trail.has(entry)) return;
    trail.add(entry);
    for (const dependency of entry.dependencies) {
      let file;
      try {
        file = createRequire(entry.manifestFile).resolve(`${dependency}/package.json`);
      } catch {}
      if (byFile.has(file)) visit(byFile.get(file), trail);
    }
    ordered.push(entry);
  };
  packages.forEach((entry) => visit(entry));
  const exports = (entry, key) =>
    entry[key].map((value) =>
      entry.direct ? value : resolveStylesheet(value, entry.manifestFile),
    );
  return [
    ...ordered.flatMap((entry) => exports(entry, 'styles')),
    ...ordered.flatMap((entry) => exports(entry, 'theme')),
  ];
}
