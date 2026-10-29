import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { validatePackageStyles, resolveStylesheet, resolvePluginEntry } from './styles.mjs';
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
  const metadataWarnings = [];
  const packageWarnings = [];
  const visited = new Set();
  const selectedNames = new Map();
  const consideredNames = new Set();
  // Finish the legacy breadth-first selection before inspecting inactive dependency trees.
  // An inventory-only edge must never claim a package before an eligible edge reaches it.
  const inventoryQueue = [];
  const queue = Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })
    .sort()
    .map((name) => ({ name, from: manifestFile }));
  while (queue.length || inventoryQueue.length) {
    const eligible = queue.length > 0;
    const { name, from } = (eligible ? queue : inventoryQueue).shift();
    if (
      Object.entries(selection ?? {}).some(
        ([key, enabled]) => key.toLowerCase() === name.toLowerCase() && enabled === false,
      )
    )
      continue;
    const firstEligible = eligible && !consideredNames.has(name.toLowerCase());
    if (eligible) consideredNames.add(name.toLowerCase());
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
          if (candidate?.bitakit || candidate?.foundation) {
            const message = `BitaKit package "${name}" cannot expose its discovery metadata. Export "./package.json" from its package.json (${error.code}).`;
            if (firstEligible) throw new Error(message);
            packageWarnings.push(message);
          }
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
    const canonicalName = (installed.name ?? name).toLowerCase();
    const selected = firstEligible && !selectedNames.has(canonicalName);
    if (selected) {
      selectedNames.set(
        canonicalName,
        `${canonicalName}@${installed.version ?? '?'} (${location})`,
      );
      if (!packages.includes(name)) packages.push(name);
    } else {
      packageWarnings.push(
        `Not selected for activation: ${canonicalName}@${installed.version ?? '?'} (${location}). ${selectedNames.has(canonicalName) ? `Using ${selectedNames.get(canonicalName)}.` : 'Only reachable through an unselected package copy.'}`,
      );
    }
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
      let publicEntry;
      try {
        publicEntry = specifier(metadata.plugin);
      } catch (error) {
        if (selected) throw error;
        packageWarnings.push(`${location}: ${error.message}`);
      }
      const plugin =
        direct && publicEntry ? publicEntry : `${name}@${installed.version ?? '?'}:${location}`;
      if (selected) plugins.push(plugin);
      pluginPackages[plugin] = {
        name: canonicalName,
        version: installed.version,
        selected,
        origin: packageOrigin('package', installed, metadataWarnings, location),
      };
      // `bitakit build` emits this optional, derived sidecar. Never execute a client entry in Node.
      let entryFile;
      try {
        if (publicEntry) entryFile = resolvePluginEntry(publicEntry, from);
      } catch {}
      imports[plugin] = direct ? publicEntry : entryFile;
      if (selected && !direct && !entryFile)
        throw new Error(`Cannot resolve BitaKit entry "${publicEntry}" from ${location}.`);
      const slotInfo =
        entryFile && /\.[cm]?[jt]sx?$/.test(entryFile)
          ? await readFile(entryFile.replace(/\.[cm]?[jt]sx?$/, '.slots.json'), 'utf8')
              .then(JSON.parse)
              .catch((error) => {
                if (error.code === 'ENOENT') return;
                if (selected) throw error;
                packageWarnings.push(
                  `Cannot read static plugin evidence for ${location}: ${error.message}`,
                );
              })
          : undefined;
      let pluginId = null;
      try {
        pluginId = staticPluginId(
          `${installed.name ?? name}@${installed.version ?? '?'} (${location})`,
          metadata,
          slotInfo,
        );
      } catch (error) {
        if (selected) throw error;
        packageWarnings.push(error.message);
      }
      pluginPackages[plugin].pluginId = pluginId;
      pluginPackages[plugin].origin.pluginId = pluginId;
      if (selected && slotInfo?.version === 1) {
        slotDeclarations.push(
          ...slotInfo.definitions.map((item) => ({ ...item, file: `${name}/${item.file}` })),
        );
        unresolvedSlots.push(...slotInfo.unresolved.map((file) => `${name}/${file}`));
      }
      if (selected && metadata.configuration) configurations[plugin] = metadata.configuration;
      // Plugin IDs the package plugin depends on at runtime; the generator adds them to the plugin.
      const ids = selected ? list(metadata.dependencies) : [];
      for (const id of ids)
        if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id))
          throw new Error(
            `Invalid plugin dependency in the bitakit manifest of package "${name}".`,
          );
      if (ids.length) dependencies[plugin] = [...new Set(ids)];
    }
    if (selected)
      stylesheets.push({
        name,
        manifestFile: file,
        manifest: installed,
        direct,
        dependencies: Object.keys({
          ...installed.dependencies,
          ...installed.peerDependencies,
        }),
        styles: list(metadata.styles).map(specifier),
        theme: list(metadata.theme).map(specifier),
      });
    // Layout packages declare the slots they render, so SlotMap and doctor know them.
    for (const slot of selected ? list(metadata.slots) : []) {
      if (typeof slot !== 'string' || !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/.test(slot))
        throw new Error(`Invalid slot name in the bitakit manifest of package "${name}".`);
      if (!slots.includes(slot)) slots.push(slot);
    }
    if (selected && metadata.discovery && !metadataOnly) {
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
      (selected ? queue : inventoryQueue).push({ name: dependency, from: file });
  }
  const styleSources = auditStyles ? await validatePackageStyles(stylesheets) : [];
  return {
    plugins,
    allPlugins: Object.keys(pluginPackages),
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
    warnings: [...metadataWarnings, ...packageWarnings],
    metadataWarnings,
    packageWarnings,
  };
}

/** Package styles after the styles of the packages they depend on; theme files come last. */
function orderStyles(packages) {
  const byName = new Map(packages.map((entry) => [entry.name.toLowerCase(), entry]));
  const ordered = [];
  const visit = (entry, trail = new Set()) => {
    if (ordered.includes(entry) || trail.has(entry)) return;
    trail.add(entry);
    for (const dependency of entry.dependencies) {
      const selected = byName.get(dependency.toLowerCase());
      if (selected) visit(selected, trail);
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
