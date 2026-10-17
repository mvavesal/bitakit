import path from 'node:path';

/**
 * The nearest plugin folder that contains `directory`, or undefined for a top-level plugin. A
 * nested folder with its own `plugin.config.ts` is a child plugin of that folder.
 */
export function parentDirectory(directory, moduleDirectories) {
  return [...moduleDirectories]
    .filter((candidate) => candidate !== directory && directory.startsWith(candidate + path.sep))
    .sort((a, b) => b.length - a.length)[0];
}

/** Immediate folders are plugins; explicit nested manifests preserve existing module boundaries. */
export function pluginManifests(directory, files) {
  const roots = new Set();
  for (const file of files) {
    const segments = path.relative(directory, file).split(path.sep);
    if (segments.some((segment) => segment.startsWith('-') || segment.startsWith('.'))) continue;
    if (segments.length > 1) roots.add(path.join(directory, segments[0], 'plugin.config.ts'));
    if (path.basename(file) === 'plugin.config.ts') roots.add(file);
  }
  return [...roots].sort();
}
