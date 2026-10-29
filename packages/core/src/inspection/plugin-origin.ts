import {
  projectPluginMetadata,
  projectPluginMetadataSources,
  type PluginMetadataSources,
} from '../metadata.js';
import type { Plugin } from '../definitions.js';

export type PluginOrigin = 'local' | 'included' | 'package' | 'unknown';
export type PackageIdentity = Readonly<{
  /** Complete lowercase name, including its npm scope. Never a runtime plugin ID. */
  name: string;
  version: string | null;
}>;
export type PluginOriginRecord = Readonly<{
  kind: Exclude<PluginOrigin, 'unknown'>;
  package?: PackageIdentity | null;
  /** Authored membership; discovery validates it. ['*'] explicitly means general purpose. */
  memberOf?: readonly string[] | null;
  /** Authoritative ID of this single definition, never a prediction from its npm name. */
  pluginId?: string | null;
  /** Sanitized, statically available package sources; never executable UI metadata. */
  metadata?: PluginMetadataSources;
  metadataWarnings?: readonly string[];
}>;
export type PluginBundle = Readonly<{ id: string; label?: string }>;
export type PluginMembership = Readonly<{
  state: 'derived' | 'declared' | 'general' | 'unspecified';
  bundles: readonly Readonly<{ id: string; resolved: boolean; label?: string }>[];
}>;

// Host evidence follows the actual definition, never its ID or an array position. Definitions
// supplied later without a binding remain unknown, even if they replace the same runtime ID.
const origins = new WeakMap<Plugin, PluginOriginRecord>();

/**
 * Binds host-recorded provenance to a fresh definition without changing execution behavior.
 * This is an attribution API for trusted hosts, not a sandbox or an authorization boundary.
 */
export function withPluginOrigin<T extends Plugin>(plugin: T, record: PluginOriginRecord): T {
  if (record.pluginId != null && record.pluginId !== plugin.id)
    throw new Error(
      `Package "${record.package?.name ?? 'unknown'}" declares plugin ID "${record.pluginId}" but loaded "${plugin.id}".`,
    );
  const packageLocation = `package "${record.package?.name ?? 'unknown'}" manifest`;
  const declared = { value: plugin.metadata, location: `plugin "${plugin.id}" metadata` };
  const canonical = { value: record.metadata?.canonical, location: packageLocation };
  const projected = record.metadata
    ? projectPluginMetadataSources([
        ...(record.kind === 'included' ? [declared, canonical] : [canonical, declared]),
        { value: record.metadata.legacy, location: `${packageLocation} legacy fields` },
      ])
    : undefined;
  const definition = {
    ...plugin,
    ...(projected ? { metadata: { ...plugin.metadata, ...projected.metadata } } : {}),
  };
  origins.set(
    definition,
    Object.freeze({
      kind: record.kind,
      ...(record.metadata
        ? {
            metadata: Object.freeze({
              canonical: Object.freeze(projectPluginMetadata(record.metadata.canonical).metadata),
              legacy: Object.freeze(projectPluginMetadata(record.metadata.legacy).metadata),
            }),
          }
        : {}),
      ...(projected?.warnings.length
        ? { metadataWarnings: Object.freeze(projected.warnings) }
        : {}),
      ...(record.pluginId == null ? {} : { pluginId: record.pluginId }),
      package: record.package
        ? Object.freeze({
            name: record.package.name.toLowerCase(),
            version: record.package.version,
          })
        : null,
      memberOf: record.memberOf ? Object.freeze([...record.memberOf]) : null,
    }),
  );
  return definition;
}

/** Reads host evidence for this definition only; never guesses from an ID or metadata. */
export function pluginOrigin(plugin: Plugin | undefined): PluginOriginRecord | undefined {
  return plugin && origins.get(plugin);
}

/** Internal composition transforms retain the host's evidence; replacement plugins do not. */
export function preservePluginOrigin<T extends Plugin>(from: Plugin, to: T): T {
  const record = origins.get(from);
  if (record) origins.set(to, record);
  return to;
}

/** Pure grouping projection. Membership never changes dependencies, ownership or enablement. */
export function pluginMembership(
  origin: PluginOriginRecord | undefined,
  context: { application?: boolean; bundle?: string; knownBundles?: readonly PluginBundle[] } = {},
): PluginMembership {
  const current = context.bundle?.toLowerCase();
  const known = new Map((context.knownBundles ?? []).map((item) => [item.id.toLowerCase(), item]));
  if (current && !known.has(current)) known.set(current, { id: current });
  const project = (state: PluginMembership['state'], ids: readonly string[]): PluginMembership =>
    Object.freeze({
      state,
      bundles: Object.freeze(
        [...new Set(ids.map((id) => id.toLowerCase()))].sort().map((id) =>
          Object.freeze({
            id,
            resolved: known.has(id),
            ...(known.get(id)?.label ? { label: known.get(id)!.label } : {}),
          }),
        ),
      ),
    });
  if (context.application || origin?.kind === 'local')
    return project('derived', current ? [current] : []);
  if (!origin) return project('unspecified', []);
  const declaration = origin.memberOf;
  if (
    !Array.isArray(declaration) ||
    !declaration.length ||
    declaration.some((id) => typeof id !== 'string' || !id)
  )
    return project('unspecified', []);
  if (declaration.includes('*'))
    return project(declaration.length === 1 ? 'general' : 'unspecified', []);
  return project('declared', declaration);
}

export type PluginGroup<T> = Readonly<{
  key: string;
  kind: 'application' | 'bundle' | 'unresolved' | 'general' | 'unspecified';
  label?: string;
  bundleId?: string;
  entries: readonly T[];
}>;

/** Groups distinct records; callers keep one shared instance/toggle for repeated appearances. */
export function groupPlugins<T extends { id: string; membership: PluginMembership }>(
  plugins: readonly T[],
  bundle?: string,
): readonly PluginGroup<T>[] {
  const current = bundle?.toLowerCase();
  const groups = new Map<
    string,
    { key: string; kind: PluginGroup<T>['kind']; label?: string; bundleId?: string; entries: T[] }
  >();
  const add = (
    key: string,
    kind: PluginGroup<T>['kind'],
    plugin: T,
    details: { label?: string; bundleId?: string } = {},
  ) => {
    if (!groups.has(key)) groups.set(key, { key, kind, ...details, entries: [] });
    const group = groups.get(key)!;
    if (!group.entries.some((entry) => entry.id === plugin.id)) group.entries.push(plugin);
  };
  for (const plugin of plugins) {
    const membership = plugin.membership;
    if (membership.state === 'derived') add('application', 'application', plugin);
    else if (membership.state === 'general' || membership.state === 'unspecified')
      add(membership.state, membership.state, plugin);
    else
      for (const entry of membership.bundles) {
        if (entry.id === current) add('application', 'application', plugin);
        else
          add(`bundle:${entry.id}`, entry.resolved ? 'bundle' : 'unresolved', plugin, {
            bundleId: entry.id,
            label: entry.label,
          });
      }
  }
  const rank = { application: 0, bundle: 1, unresolved: 2, general: 3, unspecified: 4 };
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return Object.freeze(
    [...groups.values()]
      .sort(
        (a, b) =>
          rank[a.kind] - rank[b.kind] ||
          compare(a.label ?? a.bundleId ?? a.key, b.label ?? b.bundleId ?? b.key) ||
          compare(a.key, b.key),
      )
      .map((group) => Object.freeze({ ...group, entries: Object.freeze(group.entries) })),
  );
}
