import { createDynamicPackageHost, type DynamicPackageOptions } from './dynamic-host.js';
export type { DynamicPackageOptions } from './dynamic-host.js';
export type * from './artifacts.js';
import {
  withPluginOrigin,
  getPluginOrigin,
  type BitaKitRuntime,
  type Plugin,
  type PluginChangeResult,
} from '@bitakit/core';

/** The host build owns this allowlist. Loaders return fresh definitions; they must not start work. */
export type PackageCatalog = Readonly<
  Record<
    string,
    Readonly<{
      version: string;
      /** Complete static IDs, when known. Omit for legacy or dynamic multi-plugin loaders. */
      pluginIds?: readonly string[];
      load(): Promise<readonly Plugin[]>;
    }>
  >
>;
export type PackageSelection = Readonly<{ name: string; version: string; artifact?: string }>;
export type PackageRequest = Readonly<{
  /** An opaque host generation key, not a user-supplied identity or an authorization grant. */
  scope: string;
  packages: readonly PackageSelection[];
}>;
export type PackageHostResult = Readonly<{
  status: PluginChangeResult['status'] | 'superseded';
  reasons: readonly string[];
  /** Actual scope whose definitions are still owned. A failed switch never claims the new scope. */
  scope: string | null;
}>;
type Loaded = { selection: PackageSelection; plugins: readonly Plugin[] };
const stale = Symbol('superseded package request');

/**
 * Optional host adapter over the existing lifecycle, not another plugin runtime.
 * Feed an already-authorized active package selection from outside plugin hooks/Actions.
 * Callers must finish a scope switch before revealing that scope's UI. No records are persisted.
 */
export function createPackageHost(options: {
  runtime: BitaKitRuntime;
  catalog?: PackageCatalog;
  dynamic?: DynamicPackageOptions;
}) {
  if (options.dynamic) {
    if (options.catalog)
      throw new Error('Choose the build catalog or an artifact provider for this host.');
    return createDynamicPackageHost(options.runtime, options.dynamic);
  }
  const { runtime } = options;
  const catalog: Record<string, PackageCatalog[string]> = Object.create(null);
  for (const [name, entry] of Object.entries(options.catalog ?? {})) {
    const canonical = name.toLowerCase();
    if (Object.hasOwn(catalog, canonical))
      throw new Error(`Duplicate catalog package identity "${canonical}".`);
    catalog[canonical] = Object.freeze({
      ...entry,
      ...(entry.pluginIds ? { pluginIds: Object.freeze([...entry.pluginIds]) } : {}),
    });
  }
  const loaded = new Map<string, Loaded>();
  let scope: string | null = null;
  let sequence = 0;
  let pending: AbortController | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  const result = (
    status: PackageHostResult['status'],
    reasons: readonly string[] = [],
  ): PackageHostResult => Object.freeze({ status, reasons: Object.freeze([...reasons]), scope });
  const owned = () =>
    [...loaded.values()].flatMap((entry) => entry.plugins.map((plugin) => plugin.id));

  /** Observe actual Core readiness; package ownership is not a second lifecycle state store. */
  const get = () =>
    Object.freeze({
      scope,
      packages: Object.freeze(
        [...loaded.values()].map((entry) =>
          Object.freeze({
            ...entry.selection,
            plugins: Object.freeze(
              entry.plugins.map((plugin) =>
                Object.freeze({
                  id: plugin.id,
                  ready: runtime.isReady(plugin.id),
                  phase:
                    runtime.lifecycle.get().plugins.find((item) => item.id === plugin.id)?.phase ??
                    'idle',
                }),
              ),
            ),
          }),
        ),
      ),
    });

  const remove = async (names: readonly string[]) => {
    const ids = names.flatMap((name) => loaded.get(name)?.plugins.map((plugin) => plugin.id) ?? []);
    if (!ids.length) return result('applied');
    const change = await runtime.plugins.remove(ids, { dependents: 'refuse' });
    if (change.status === 'applied') for (const name of names) loaded.delete(name);
    return result(change.status, change.reasons);
  };

  // Native imports cannot be cancelled, but an obsolete import must not hold up the next scope.
  const load = (entry: PackageCatalog[string], signal: AbortSignal) =>
    new Promise<readonly Plugin[]>((resolve, reject) => {
      const cancel = () => reject(stale);
      if (signal.aborted) {
        cancel();
        return;
      }
      signal.addEventListener('abort', cancel, { once: true });
      Promise.resolve()
        .then(() => entry.load())
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', cancel));
    });

  async function apply(
    request: PackageRequest,
    revision: number,
    signal: AbortSignal,
  ): Promise<PackageHostResult> {
    const current = () => revision === sequence && !signal.aborted;
    if (!current()) return result('superseded');
    try {
      // Scope identity is a lifetime boundary even when both scopes select the same package.
      if (scope !== null && scope !== request.scope) {
        const removal = await remove([...loaded.keys()]);
        if (removal.status !== 'applied') return removal;
        scope = null;
      }
      if (!current()) return result('superseded');
      const requested = new Set(request.packages.map((entry) => entry.name));
      const removal = await remove([...loaded.keys()].filter((name) => !requested.has(name)));
      if (removal.status !== 'applied') return removal;
      if (!current()) return result('superseded');
      // A clean failed/disabled installation is explicitly removed before a fresh activation.
      const retry = request.packages
        .filter((entry) =>
          loaded.get(entry.name)?.plugins.some((plugin) => !runtime.isReady(plugin.id)),
        )
        .map((entry) => entry.name);
      if (retry.length) {
        const recovery = await remove(retry);
        if (recovery.status !== 'applied') return recovery;
      }
      // Existing definitions occupy their IDs even while disabled. Check every known incoming
      // ID before invoking any new loader; legacy loaders still get the ordinary post-load check.
      const owners = new Map([
        [runtime.config.appId ?? 'app', 'application'],
        ...(runtime.config.plugins ?? []).map(
          (plugin) =>
            [plugin.id, getPluginOrigin(plugin)?.package?.name ?? `plugin "${plugin.id}"`] as const,
        ),
      ]);
      for (const selection of request.packages.filter((entry) => !loaded.has(entry.name))) {
        for (const id of catalog[selection.name].pluginIds ?? []) {
          if (owners.has(id))
            return result('blocked', [
              `Plugin ID "${id}" conflicts between ${owners.get(id)} and package "${selection.name}".`,
            ]);
          owners.set(id, `package "${selection.name}"`);
        }
      }
      const additions = await Promise.all(
        request.packages
          .filter((entry) => !loaded.has(entry.name))
          .map(async (selection) => {
            const entry = catalog[selection.name];
            const definitions = [...(await load(entry, signal))];
            if (
              entry.pluginIds &&
              (definitions.length !== entry.pluginIds.length ||
                definitions.some((plugin) => !entry.pluginIds!.includes(plugin.id)))
            )
              throw new Error(
                `Package "${selection.name}" declares plugin IDs [${entry.pluginIds.join(', ')}] but loaded [${definitions.map((plugin) => plugin.id).join(', ')}].`,
              );
            return {
              selection,
              plugins: definitions.map((plugin) =>
                withPluginOrigin(plugin, {
                  ...getPluginOrigin(plugin),
                  kind: 'package',
                  package: {
                    name: getPluginOrigin(plugin)?.package?.name ?? selection.name,
                    version: selection.version,
                  },
                }),
              ),
            };
          }),
      );
      if (!current()) return result('superseded');
      const plugins = additions.flatMap((entry) => entry.plugins);
      if (additions.some((entry) => !entry.plugins.length))
        return result('blocked', ['A catalog package must provide at least one plugin.']);
      const ids = [...owned(), ...plugins.map((plugin) => plugin.id)];
      if (new Set(ids).size !== ids.length)
        return result('blocked', ['Catalog packages have overlapping plugin IDs.']);
      if (plugins.length) {
        const change = await runtime.plugins.add(plugins);
        // Failed startup may leave installed definitions with failed/blocked lifecycle entries.
        for (const entry of additions)
          if (entry.plugins.every((plugin) => runtime.config.plugins?.includes(plugin)))
            loaded.set(entry.selection.name, entry);
        if (loaded.size) scope = request.scope;
        if (change.status !== 'applied') return result(change.status, change.reasons);
      }
      scope = request.scope;
      return result('applied');
    } catch (error) {
      if (error === stale || !current()) return result('superseded');
      return result('failed', [error instanceof Error ? error.message : String(error)]);
    }
  }

  /**
   * Apply an authorized active selection. Pending imports are superseded; lifecycle operations
   * finish first. Calls during any runtime hook/update are blocked instead of queued behind
   * themselves. Retry those calls after the current operation settles.
   */
  function reconcile(input: PackageRequest): Promise<PackageHostResult> {
    if (runtime.lifecycle.get().operation || !runtime.isReady())
      return Promise.resolve(
        result('blocked', [
          'Wait for the runtime lifecycle operation to settle before changing package selection.',
        ]),
      );
    const request = {
      scope: input.scope,
      packages: input.packages.map((entry) =>
        Object.freeze({ ...entry, name: entry.name.toLowerCase() }),
      ),
    };
    const names = request.packages.map((entry) => entry.name);
    if (new Set(names).size !== names.length)
      return Promise.resolve(result('blocked', ['Select each package once.']));
    for (const entry of request.packages)
      if (!Object.hasOwn(catalog, entry.name) || catalog[entry.name].version !== entry.version)
        return Promise.resolve(
          result('blocked', [
            `Package "${entry.name}@${entry.version}" is not in this build's trusted catalog.`,
          ]),
        );
    const revision = ++sequence;
    pending?.abort();
    const controller = (pending = new AbortController());
    const work = tail.then(() => apply(request, revision, controller.signal));
    tail = work.catch(() => {});
    return work;
  }
  return Object.freeze({
    reconcile,
    get,
    recover: async () => result('applied'),
    dispose: () => reconcile({ scope: scope ?? '', packages: [] }),
  });
}
