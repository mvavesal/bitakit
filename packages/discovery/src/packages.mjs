import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { validatePackageStyles } from './styles.mjs';

/**
 * Reads opt-in metadata (`bitakit` in package.json, `foundation` as the older name) from direct
 * dependencies and, transitively, from the plugin packages they depend on, so a plugin package
 * activates the plugin packages it depends on. Never imports client code in Node.
 */
export async function installedContributions(root, selection, jiti) {
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
  const plugins = [];
  const kinds = [];
  const configurations = {};
  const dependencies = {};
  const stylesheets = [];
  const packages = [];
  const slots = [];
  const slotDeclarations = [];
  const unresolvedSlots = [];
  const visited = new Set();
  const queue = Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })
    .sort()
    .map((name) => ({ name, from: manifestFile }));
  while (queue.length) {
    const { name, from } = queue.shift();
    if (visited.has(name) || selection?.[name] === false) continue;
    visited.add(name);
    let file;
    try {
      file = createRequire(from).resolve(`${name}/package.json`);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        // Inspect only to diagnose an inaccessible opt-in manifest, never to bypass exports.
        for (const directory of createRequire(from).resolve.paths(name) ?? []) {
          const candidate = await readFile(path.join(directory, name, 'package.json'), 'utf8')
            .then(JSON.parse).catch((failure) => { if (failure.code !== 'ENOENT') throw failure; });
          if (candidate?.bitakit || candidate?.foundation)
            throw new Error(`BitaKit package "${name}" cannot expose its discovery metadata. Export "./package.json" from its package.json (${error.code}).`);
          if (candidate) break;
        }
        continue;
      }
      throw error;
    }
    const installed = JSON.parse(await readFile(file, 'utf8'));
    const metadata = installed.bitakit ?? installed.foundation;
    if (!metadata) continue;
    packages.push(name);
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
      const plugin = specifier(metadata.plugin);
      plugins.push(plugin);
      // `bitakit build` emits this optional, derived sidecar. Never execute a client entry in Node.
      let entryFile;
      try { entryFile = createRequire(from).resolve(plugin); }
      catch (error) { if (!['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code)) throw error; }
      const slotInfo = entryFile && /\.[cm]?[jt]sx?$/.test(entryFile)
        ? await readFile(entryFile.replace(/\.[cm]?[jt]sx?$/, '.slots.json'), 'utf8')
          .then(JSON.parse).catch((error) => { if (error.code !== 'ENOENT') throw error; })
        : undefined;
      if (slotInfo?.version === 1) {
        slotDeclarations.push(...slotInfo.definitions.map((item) => ({ ...item, file: `${name}/${item.file}` })));
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
        dependencies: Object.keys({ ...installed.dependencies, ...installed.peerDependencies }),
        styles: list(metadata.styles).map(specifier),
        theme: list(metadata.theme).map(specifier),
      });
    // Layout packages declare the slots they render, so SlotMap and doctor know them.
    for (const slot of list(metadata.slots)) {
      if (typeof slot !== 'string' || !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/.test(slot))
        throw new Error(`Invalid slot name in the bitakit manifest of package "${name}".`);
      if (!slots.includes(slot)) slots.push(slot);
    }
    if (metadata.discovery) {
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
      if (!visited.has(dependency)) queue.push({ name: dependency, from: file });
  }
  const styleSources = await validatePackageStyles(stylesheets);
  return {
    plugins,
    kinds,
    configurations,
    dependencies,
    styles: orderStyles(stylesheets),
    styleSources,
    packages,
    slots,
    slotDeclarations,
    unresolvedSlots,
  };
}

/** Package styles after the styles of the packages they depend on; theme files come last. */
function orderStyles(packages) {
  const byName = new Map(packages.map((entry) => [entry.name, entry]));
  const ordered = [];
  const visit = (entry, trail = new Set()) => {
    if (ordered.includes(entry) || trail.has(entry)) return;
    trail.add(entry);
    for (const dependency of entry.dependencies)
      if (byName.has(dependency)) visit(byName.get(dependency), trail);
    ordered.push(entry);
  };
  packages.forEach((entry) => visit(entry));
  return [...ordered.flatMap((entry) => entry.styles), ...ordered.flatMap((entry) => entry.theme)];
}
