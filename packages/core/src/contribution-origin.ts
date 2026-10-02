const origins = new WeakMap<object, readonly string[]>();
const sources = new WeakMap<object, string>();
export function contributionPath(entry: object): readonly string[] | undefined {
  return origins.get(entry);
}
/** Project-relative file that declared a contribution, recorded by discovery for diagnostics. */
export function contributionSource(entry: object): string | undefined {
  return sources.get(entry);
}
export function preserveContributionPath(from: object, to: object) {
  const path = origins.get(from);
  if (path) origins.set(to, path);
  const source = sources.get(from);
  if (source) sources.set(to, source);
  return to;
}

export function setContributionPath(entry: object, path: readonly string[], source?: string) {
  origins.set(entry, path);
  if (source) sources.set(entry, source);
}
export function setContributionSource(entry: object, source: string) {
  sources.set(entry, source);
}
