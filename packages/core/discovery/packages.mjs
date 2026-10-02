import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Reads opt-in metadata from direct dependencies. Never imports client plugin code in Node. */
export async function installedContributions(root, selection, jiti) {
  if (selection === false) return { plugins: [], kinds: [], styles: [] };
  const manifestFile = path.join(root, 'package.json');
  const manifest = await readFile(manifestFile, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    });
  const require = createRequire(manifestFile);
  const plugins = [];
  const kinds = [];
  const configurations = {};
  const stylesheets = [];
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  }).sort()) {
    if (selection?.[name] === false) continue;
    let file;
    try {
      // Opt-in packages expose their manifest as a public subpath.
      file = require.resolve(`${name}/package.json`);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')
        continue;
      throw error;
    }
    const installed = JSON.parse(await readFile(file, 'utf8'));
    const metadata = installed.foundation;
    if (!metadata) continue;
    const specifier = (entry) => {
      if (
        typeof entry !== 'string' ||
        !/^\.\/[\w./-]+$/.test(entry) ||
        entry.split('/').includes('..')
      )
        throw new Error(`Invalid Foundation export in package "${name}".`);
      return `${name}/${entry.slice(2)}`;
    };
    if (metadata.plugin) {
      const plugin = specifier(metadata.plugin);
      plugins.push(plugin);
      if (metadata.configuration) configurations[plugin] = metadata.configuration;
    }
    const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
    if (metadata.styles || metadata.theme)
      stylesheets.push({
        name,
        dependencies: Object.keys({ ...installed.dependencies, ...installed.peerDependencies }),
        styles: list(metadata.styles).map(specifier),
        theme: list(metadata.theme).map(specifier),
      });
    if (metadata.discovery) {
      const discover = await jiti.import(require.resolve(specifier(metadata.discovery)), {
        default: true,
      });
      kinds.push(...discover());
    }
  }
  return { plugins, kinds, configurations, styles: orderStyles(stylesheets) };
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
