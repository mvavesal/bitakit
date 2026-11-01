import type { ActionMapOptions } from './actions/types.js';

/**
 * A name that discovery generates: an Action ID, event, slot, setting or service name.
 * Known names autocomplete. Unknown strings stay allowed until the generated `strict` switch
 * (`ActionMapOptions { strict: true }`, on by default in generated apps) turns typos into type
 * errors. Packages compiled without generated maps keep the loose form.
 */
export type GeneratedName<Known extends string> = ActionMapOptions extends { strict: true }
  ? Known
  : Known | (string & {});

/** Checks a caller's string literal without enumerating exponentially many case permutations. */
export type CheckedName<Name extends string, Known extends string> = ActionMapOptions extends {
  strict: true;
}
  ? Lowercase<Name> extends Lowercase<Known>
    ? Name
    : never
  : Name;
