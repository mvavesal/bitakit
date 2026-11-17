import type { ContributionMap, Plugin } from '../definitions.js';
import type { ServerConfig } from './types.js';

type ValueOf<K extends string> = K extends keyof ContributionMap ? ContributionMap[K] : unknown;

/**
 * The values of one contribution kind with the module that contributed each, in composition
 * order: the app module first (for a config), then its plugins. Pure: it reads definitions only,
 * starts nothing and needs no installer, so hosts read server-only kinds with it.
 */
export function contributionsOf<K extends string>(
  source: ServerConfig | readonly Plugin[],
  kind: K,
): readonly { readonly plugin: string; readonly value: ValueOf<K> }[] {
  const modules: readonly Pick<Plugin, 'id' | 'contributions'>[] = Array.isArray(source)
    ? source
    : [
        {
          id: (source as ServerConfig).appId ?? 'app',
          contributions: (source as ServerConfig).contributions,
        },
        ...((source as ServerConfig).plugins ?? []),
      ];
  return Object.freeze(
    modules.flatMap((module) =>
      (module.contributions?.[kind] ?? []).map((value) =>
        Object.freeze({ plugin: module.id, value: value as ValueOf<K> }),
      ),
    ),
  );
}
