import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  packageMetadataSources,
  projectPluginMetadata,
  projectPluginMetadataSources,
} from '@bitakit/core';
import validatePackageName from 'validate-npm-package-name';

/** Canonical identity preserves the complete scope and uses npm's name rules, not a new grammar. */
export function canonicalPackageName(value) {
  if (typeof value !== 'string') return null;
  const name = value.toLowerCase();
  return validatePackageName(name).validForNewPackages ? name : null;
}

export async function readPackage(folder) {
  const file = path.join(folder, 'package.json');
  return readFile(file, 'utf8')
    .then((source) => ({ manifest: JSON.parse(source), file }))
    .catch((error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
}

/** Stops at the discovered host root; an unrelated workspace above it is never the app. */
export async function readApplicationPackage(directory, root) {
  const relative = path.relative(root, directory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    return (await readPackage(root)) ?? { manifest: {}, file: path.join(root, 'package.json') };
  for (let folder = directory; ; folder = path.dirname(folder)) {
    const manifest = await readPackage(folder);
    if (manifest) return manifest;
    if (folder === root || path.dirname(folder) === folder)
      return { manifest: {}, file: path.join(root, 'package.json') };
  }
}

/** Passive host evidence only. Optional metadata problems are warnings, never loader errors. */
export function packageOrigin(kind, manifest = {}, warnings = [], location = 'package.json') {
  const name = canonicalPackageName(manifest.name);
  const metadata = manifest.bitakit ?? manifest.foundation ?? {};
  const sources = packageMetadataSources(manifest);
  const projected = projectPluginMetadataSources([
    { value: sources.canonical, location },
    { value: sources.legacy, location: `${location} legacy fields` },
  ]);
  warnings.push(...projected.warnings);
  let memberOf = metadata.memberOf;
  if (
    memberOf !== undefined &&
    (!Array.isArray(memberOf) ||
      !memberOf.length ||
      (memberOf.includes('*')
        ? memberOf.length !== 1
        : memberOf.some((id) => !canonicalPackageName(id))))
  ) {
    warnings.push(`Invalid bitakit.memberOf in ${location}; membership is unspecified.`);
    memberOf = undefined;
  }
  return {
    kind,
    ...(kind === 'local'
      ? {}
      : {
          metadata: {
            canonical: projectPluginMetadata(sources.canonical).metadata,
            legacy: projectPluginMetadata(sources.legacy).metadata,
          },
        }),
    package: name
      ? { name, version: typeof manifest.version === 'string' ? manifest.version : null }
      : null,
    memberOf: kind === 'local' ? null : (memberOf ?? null),
  };
}

/** Application identity and known labels are host inputs; package claims never extend this list. */
export function applicationBundles(manifest, declarations, warnings = []) {
  const explicit = (manifest.bitakit ?? manifest.foundation)?.bundle;
  const bundle = canonicalPackageName(explicit) ?? canonicalPackageName(manifest.name);
  if (explicit !== undefined && !canonicalPackageName(explicit))
    warnings.push(
      'Invalid bitakit.bundle in the application package; using its package-name fallback.',
    );
  const known = new Map();
  if (declarations !== undefined && !Array.isArray(declarations))
    warnings.push('Invalid bundles in bitakit.config.ts; expected an array of { id, label? }.');
  for (const item of Array.isArray(declarations) ? declarations : []) {
    const id = canonicalPackageName(item?.id);
    if (!id) {
      warnings.push('Invalid known bundle in bitakit.config.ts; ignoring that entry.');
      continue;
    }
    const label = typeof item.label === 'string' ? item.label : undefined;
    if (known.has(id) && known.get(id).label !== label) {
      warnings.push(`Conflicting labels for bundle "${id}"; displaying its ID.`);
      known.set(id, { id, conflict: true });
    } else if (!known.has(id)) known.set(id, { id, ...(label ? { label } : {}) });
  }
  return {
    ...(bundle ? { bundle } : {}),
    knownBundles: [...known.values()]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(({ id, label }) => ({ id, ...(label ? { label } : {}) })),
  };
}

/** Folder declarations, including explicitly included folders, retain historical precedence. */
export function folderMetadata(
  kind,
  manifest,
  legacy,
  warnings = [],
  location = 'plugin.config.ts',
  packageLocation = 'package.json',
) {
  const sources = packageMetadataSources(manifest);
  const result = projectPluginMetadataSources([
    { value: legacy, location },
    {
      value: { ...sources.canonical, ...(kind === 'local' ? { title: undefined } : {}) },
      location: packageLocation,
    },
    { value: sources.legacy, location: `${packageLocation} legacy fields` },
  ]);
  // Package identity is a compatibility fallback, not a competing authored display name.
  if (result.metadata.name === undefined && typeof manifest.name === 'string')
    result.metadata.name = manifest.name;
  warnings.push(...result.warnings);
  return result.metadata;
}
