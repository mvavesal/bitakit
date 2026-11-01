/** Build-time resolution preserves exact IDs and never rewrites filesystem paths. */
export function resolveName(name, candidates) {
  const names = [...candidates];
  if (names.includes(name)) return name;
  const matches = [
    ...new Set(names.filter((candidate) => candidate.toLowerCase() === name.toLowerCase())),
  ];
  if (matches.length > 1)
    throw new Error(`Ambiguous identifier "${name}". Use the exact registered spelling.`);
  return matches[0] ?? name;
}
export function resolveOverrides(overrides = {}, ids) {
  const resolved = Object.create(null);
  for (const [name, value] of Object.entries(overrides)) {
    const id = resolveName(name, ids);
    if (Object.hasOwn(resolved, id)) throw new Error(`Duplicate override for "${id}".`);
    resolved[id] = value;
  }
  return resolved;
}
