import type { Plugin } from '../definitions.js';
import type { NormalizedPlugin } from '../runtime.js';

export type PluginUpdateResult = Readonly<{
  status: 'applied' | 'blocked' | 'failed' | 'restart-required';
  revision: number;
  changed: readonly string[];
  affected: readonly string[];
  reasons: readonly string[];
}>;

/** Host constraints are checked again immediately before a structural update. */
export type PluginChangeOptions = Readonly<{
  expectedRevision?: number;
  /** Owners that must remain enabled, for example the host's management surface. */
  preserve?: readonly string[];
}>;
/** Explicit host policy when other enabled plugins require the selected owner. */
export type PluginDependentOptions = PluginChangeOptions &
  Readonly<{ dependents: 'stop' | 'refuse' }>;
export type PluginToggleRequest = PluginChangeOptions &
  (
    | Readonly<{ operation: 'enable'; id: string }>
    | Readonly<{ operation: 'disable'; id: string; dependents: 'stop' | 'refuse' }>
  );
export type PluginChangeReason =
  | 'busy'
  | 'cleanup-failed'
  | 'stale'
  | 'protected'
  | 'dependents'
  | 'owner-disabled'
  | 'composition'
  | 'invalid'
  | 'pending-settings';
/** Read-only planning result. It grants no authority to execute a stale operation. */
export type PluginChangePreview = Readonly<{
  status: 'ready' | 'blocked' | 'restart-required';
  revision: number;
  changed: readonly string[];
  affected: readonly string[];
  dependents: readonly string[];
  reason: PluginChangeReason | null;
  blockers: readonly string[];
  reasons: readonly string[];
}>;
export type PlannedPluginChange = {
  preview: PluginChangePreview;
  apply?: () => Promise<PluginUpdateResult>;
};
export type PluginChangeResult = PluginUpdateResult;

/** Lifecycle edges include required service aliases, not just explicit plugin dependencies. */
export function pluginDependencies(modules: readonly NormalizedPlugin[]) {
  const owners = new Map<string, string>();
  for (const module of modules)
    for (const service of module.services)
      for (const name of [service.id, service.exposeAs, service.provides])
        if (name) owners.set(name as string, module.id);
  return new Map(
    modules.map((module) => [
      module.id,
      new Set([
        ...(module.dependencies ?? []),
        ...[...module.services, ...module.actions, ...(module.interceptors ?? [])]
          .flatMap((value) => value.requires ?? [])
          .map((name) => owners.get(name))
          .filter((id): id is string => !!id && id !== module.id),
      ]),
    ]),
  );
}

export function updateClosure(modules: readonly NormalizedPlugin[], changed: readonly string[]) {
  const edges = pluginDependencies(modules);
  const affected = new Set(changed);
  for (let added = true; added; ) {
    added = false;
    for (const [id, requirements] of edges)
      if (!affected.has(id) && [...requirements].some((name) => affected.has(name))) {
        affected.add(id);
        added = true;
      }
  }
  const order: string[] = [];
  const remaining = new Set(affected);
  while (remaining.size) {
    const id = [...remaining].find(
      (id) => ![...(edges.get(id) ?? [])].some((name) => remaining.has(name)),
    );
    if (!id)
      throw new Error(
        'Plugin update has a cyclic lifecycle dependency; a full restart is required.',
      );
    order.push(id);
    remaining.delete(id);
  }
  return order;
}

const list = (values: readonly string[] = []) => JSON.stringify([...values].sort());
/** Conservative compatibility check. No schema/function serialization or guessed code hashes. */
export function updateRestrictions(
  previous: Plugin,
  next: Plugin,
  before: NormalizedPlugin,
  after: NormalizedPlugin,
): string[] {
  const reasons: string[] = [];
  for (const field of [
    'settings',
    'events',
    'config',
    'slots',
    'interceptors',
    'installs',
    'contributions',
  ] as const)
    if (previous[field] !== next[field])
      reasons.push(`${previous.id}: ${field} declarations changed.`);
  if (list(previous.dependencies) !== list(next.dependencies))
    reasons.push(`${previous.id}: dependencies changed.`);
  for (const field of ['providers', 'layouts'] as const)
    if (previous.ui?.[field] !== next.ui?.[field])
      reasons.push(`${previous.id}: UI ${field} changed.`);
  const shape = (module: NormalizedPlugin) =>
    module.services
      .map((service) => [service.id, service.exposeAs, service.provides, list(service.requires)])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (JSON.stringify(shape(before)) !== JSON.stringify(shape(after)))
    reasons.push(`${previous.id}: service identities or dependencies changed.`);
  return reasons;
}
