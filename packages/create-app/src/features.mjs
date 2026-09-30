/** Only capabilities with a working starter integration are offered. */
export const features = {
  preferences: { label: 'App Preferences', requires: [] },
  shell: { label: 'App Shell and settings pages', requires: ['preferences'] },
  'quick-search': { label: 'Quick Search', requires: ['shell'] },
};

/** Resolve prerequisites once; adapters consume the same selected set. */
export function resolveFeatures(selected) {
  const result = new Set();
  const add = (name) => {
    const feature = Object.hasOwn(features, name) ? features[name] : undefined;
    if (!feature)
      throw new Error(`Unknown feature "${name}". Choose ${Object.keys(features).join(', ')}.`);
    if (result.has(name)) return;
    feature.requires.forEach(add);
    result.add(name);
  };
  selected.forEach(add);
  return [...result];
}
