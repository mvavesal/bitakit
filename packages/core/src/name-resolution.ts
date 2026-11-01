/** Exact spellings remain authoritative; a folded reference must identify exactly one name. */
export function resolveName(name: string, candidates: Iterable<string>): string {
  let match: string | undefined;
  let ambiguous = false;
  for (const candidate of candidates) {
    if (candidate === name) return name;
    if (candidate.toLowerCase() !== name.toLowerCase()) continue;
    if (match !== undefined && match !== candidate) ambiguous = true;
    match = candidate;
  }
  if (ambiguous)
    throw new Error(`Ambiguous identifier "${name}". Use the exact registered spelling.`);
  return match ?? name;
}
/** Resolves keys without renaming stored entries or collapsing existing case-only definitions. */
export function namedRecord<T extends object>(record: T): T {
  return new Proxy(record, {
    get: (target, name, receiver) =>
      Reflect.get(
        target,
        typeof name === 'string' ? resolveName(name, Object.keys(target)) : name,
        receiver,
      ),
    has: (target, name) =>
      Reflect.has(target, typeof name === 'string' ? resolveName(name, Object.keys(target)) : name),
  });
}
/** Exact map keys take precedence, including when two existing keys differ only in case. */
type FoldedKey<Keys extends string, Name extends string> = Keys extends unknown
  ? Lowercase<Keys> extends Lowercase<Name>
    ? Keys
    : never
  : never;
export type NameKey<Map, Name extends string> = string extends Name
  ? never
  : Name extends keyof Map
    ? Name
    : FoldedKey<Extract<keyof Map, string>, Name>;
export type NamedValue<Map, Name extends string, Fallback = unknown> = [
  NameKey<Map, Name>,
] extends [never]
  ? Fallback
  : Map[NameKey<Map, Name>];
