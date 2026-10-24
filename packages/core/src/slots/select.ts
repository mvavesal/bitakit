import type { SlotItem } from './types.js';

/**
 * The result of selecting the occupant of a `single` slot. `reason` explains why no candidate
 * was selected: several candidates without a decision (`ambiguous`), or a choice that names no
 * available candidate (`choice-unavailable`). Without candidates, both are absent.
 */
export type SingleSelection<T extends Pick<SlotItem, 'plugin' | 'key'> = SlotItem> = Readonly<{
  selected?: T;
  reason?: 'ambiguous' | 'choice-unavailable';
  candidates: readonly T[];
}>;

/** The names a choice may use for a candidate: `<plugin>`, `<plugin>:<key>` and `<key>`. */
export function candidateNames(item: Pick<SlotItem, 'plugin' | 'key'>): readonly string[] {
  return item.key === undefined
    ? [item.plugin]
    : [item.plugin, `${item.plugin}:${item.key}`, item.key];
}

/**
 * Selects the occupant of a `single` slot from its eligible candidates. The app's choice wins
 * (`choose` in bitakit.config.ts), then a contribution of the app itself, then the only
 * candidate. Several candidates without a decision select none, so owners render their default
 * instead of an arbitrary contribution.
 */
export function selectSingle<T extends Pick<SlotItem, 'plugin' | 'key'>>(
  candidates: readonly T[],
  options: { choice?: string; appId: string },
): SingleSelection<T> {
  if (options.choice !== undefined) {
    const matches = candidates.filter((item) => candidateNames(item).includes(options.choice!));
    if (matches.length === 1) return { selected: matches[0], candidates };
    return { reason: matches.length ? 'ambiguous' : 'choice-unavailable', candidates };
  }
  const own = candidates.filter((item) => item.plugin === options.appId);
  const pool = own.length ? own : candidates;
  if (pool.length === 1) return { selected: pool[0], candidates };
  return pool.length ? { reason: 'ambiguous', candidates } : { candidates };
}
