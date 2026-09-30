import path from 'node:path';

/** Immediate folders are plugins; explicit nested manifests preserve existing module boundaries. */
export function pluginManifests(directory, files) {
  const roots = new Set();
  for (const file of files) {
    const segments = path.relative(directory, file).split(path.sep);
    if (segments.some(segment => segment.startsWith('-') || segment.startsWith('.'))) continue;
    if (segments.length > 1) roots.add(path.join(directory, segments[0], 'plugin.config.ts'));
    if (path.basename(file) === 'plugin.config.ts') roots.add(file);
  }
  return [...roots].sort();
}
