const origins = new WeakMap<object, readonly string[]>();
export function contributionPath(entry: object): readonly string[] | undefined {
  return origins.get(entry);
}
export function preserveContributionPath(from: object, to: object) {
  const path = origins.get(from);
  if (path) origins.set(to, path);
  return to;
}

export function setContributionPath(entry: object, path: readonly string[]) {
  origins.set(entry, path);
}
