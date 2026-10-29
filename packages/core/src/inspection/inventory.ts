import { projectPluginMetadata } from '../metadata.js';
import type { PluginMetadata } from '../definitions.js';
import type { LifecyclePhase, LifecycleSnapshot } from '../lifecycle/state.js';
import type { BitaKitRuntime } from '../runtime.js';
import { contributionSource } from '../contribution-origin.js';
import {
  pluginOrigin,
  pluginMembership,
  type PluginOrigin,
  type PackageIdentity,
  type PluginMembership,
} from './plugin-origin.js';

export type InventoryKind =
  | 'service'
  | 'action'
  | 'event'
  | 'page'
  | 'setting'
  | 'slot'
  | 'widget'
  | 'provider'
  | 'config'
  | 'interceptor';
export type InventoryDeclaration = Readonly<{
  kind: InventoryKind;
  id: string | null;
  source: string | null;
  resolution: 'resolved' | 'file';
}>;
export type InventoryMetadata = Readonly<
  Pick<
    PluginMetadata,
    | 'name'
    | 'title'
    | 'description'
    | 'version'
    | 'license'
    | 'homepage'
    | 'tags'
    | 'keywords'
    | 'repository'
    | 'coverImage'
  > & { author?: string; support?: string }
>;
export type InventoryPlugin = Readonly<{
  /** Stable inventory key; an unresolved package uses its export specifier. */
  id: string;
  pluginId: string | null;
  enabled: boolean | null;
  source: Readonly<{ kind: 'runtime' | 'file' | 'package'; path: string | null }>;
  metadata: InventoryMetadata;
  dependencies: readonly string[] | null;
  declarations: readonly InventoryDeclaration[] | null;
  /** Additive host evidence; older inventory producers may omit these fields. */
  origin?: PluginOrigin;
  application?: boolean;
  parent?: string | null;
  package?: PackageIdentity | null;
  declaredMembership?: readonly string[] | null;
  membership?: PluginMembership;
  metadataWarnings?: readonly string[];
}>;
export type InventoryLive = Readonly<{
  revision: number;
  phase: LifecyclePhase;
  cleanup: LifecycleSnapshot['cleanup'];
  operation: LifecycleSnapshot['operation'];
  plugins: readonly Readonly<{ id: string; phase: LifecyclePhase; since: number }>[];
  services: readonly Readonly<{
    id: string;
    plugin: string;
    phase: LifecyclePhase;
    since: number;
  }>[];
  actions: readonly Readonly<{
    id: string;
    plugin: string | null;
    enabled: boolean;
    visible: boolean;
    pending: boolean;
  }>[];
  slots: readonly Readonly<{
    id: string;
    plugin: string;
    phase: LifecyclePhase;
    count: number;
    /** Headless inspection cannot observe React outlet instances or contextual rendering. */
    mountedOutlets: null;
    visibleCount: null;
    renderFailures: null;
  }>[];
}>;
export type RuntimeInventory = Readonly<{
  version: 1;
  static: Readonly<{ plugins: readonly InventoryPlugin[] }>;
  /** Null means there is no running process to inspect, never an empty/healthy runtime. */
  live: InventoryLive | null;
}>;

/** Public declaration metadata only; no icons, functions, defaults, credentials or arbitrary fields. */
export function inventoryMetadata(metadata: PluginMetadata = {}): InventoryMetadata {
  metadata = projectPluginMetadata(metadata).metadata;
  const result: Record<string, unknown> = {};
  for (const key of [
    'name',
    'title',
    'description',
    'version',
    'license',
    'homepage',
    'coverImage',
  ] as const)
    if (typeof metadata[key] === 'string') result[key] = metadata[key];
  const author = typeof metadata.author === 'string' ? metadata.author : metadata.author?.name;
  const support = typeof metadata.bugs === 'string' ? metadata.bugs : metadata.bugs?.url;
  if (author) result.author = author;
  if (support) result.support = support;
  if (metadata.tags) result.tags = Object.freeze([...metadata.tags]);
  if (metadata.keywords) result.keywords = Object.freeze([...metadata.keywords]);
  if (metadata.repository)
    result.repository =
      typeof metadata.repository === 'string'
        ? metadata.repository
        : Object.freeze({ ...metadata.repository });
  return Object.freeze(result);
}

/** Both static tooling and runtime readers produce this versioned, serializable envelope. */
export function createInventory(
  plugins: readonly InventoryPlugin[],
  live: InventoryLive | null = null,
): RuntimeInventory {
  return Object.freeze({
    version: 1,
    static: Object.freeze({ plugins: Object.freeze([...plugins]) }),
    live,
  });
}

export function inspectRuntime(runtime: BitaKitRuntime): RuntimeInventory {
  const entry = (kind: InventoryKind, id: string, value?: object): InventoryDeclaration =>
    Object.freeze({
      kind,
      id,
      source: value ? (contributionSource(value) ?? null) : null,
      resolution: 'resolved',
    });
  const lifecycle = runtime.lifecycle.get();
  const provenance = (id: string, parent?: string) => {
    const application = id === (runtime.config.appId ?? 'app');
    const source = pluginOrigin(runtime.config.plugins?.find((plugin) => plugin.id === id));
    return {
      application,
      origin: source?.kind ?? ('unknown' as const),
      ...(source?.metadataWarnings?.length ? { metadataWarnings: source.metadataWarnings } : {}),
      parent: parent ?? null,
      package: source?.package ?? null,
      declaredMembership: source?.memberOf ?? null,
      membership: pluginMembership(source, {
        application,
        bundle: runtime.config.bundle,
        knownBundles: runtime.config.knownBundles,
      }),
    };
  };
  return createInventory(
    [
      ...runtime.modules.map((module) =>
        Object.freeze({
          id: module.id,
          pluginId: module.id,
          ...provenance(module.id, module.parent),
          enabled: true,
          source: Object.freeze({ kind: 'runtime' as const, path: null }),
          metadata: inventoryMetadata(module.metadata),
          dependencies: Object.freeze([...(module.dependencies ?? [])]),
          declarations: Object.freeze([
            ...module.services.map((value) => entry('service', value.id, value)),
            ...module.actions
              .filter((value) => !value.internal)
              .map((value) => entry('action', value.id, value)),
            ...module.pages.map((value) => entry('page', value.path, value)),
            ...module.slots.map((value) => entry('slot', value.id, value)),
            ...module.views.map((value) => entry('widget', value.slot, value)),
            ...module.providers.map((value) => entry('provider', value.id, value)),
            ...Object.keys(module.events?.events ?? {}).map((name) =>
              entry('event', `${module.id}.${name}`),
            ),
            ...Object.keys(module.settings?.settings ?? {}).map((name) =>
              entry(
                'setting',
                module.id === (runtime.config.appId ?? 'app') ? name : `${module.id}.${name}`,
              ),
            ),
            ...(module.config ? [entry('config', module.id)] : []),
            ...(module.interceptors ?? []).map((value, index) =>
              entry('interceptor', `${module.id}:${index}`, value),
            ),
          ]),
        }),
      ),
      ...(runtime.config.plugins ?? [])
        .filter((plugin) => !runtime.modules.some((module) => module.id === plugin.id))
        .map((plugin) =>
          Object.freeze({
            id: plugin.id,
            pluginId: plugin.id,
            ...provenance(plugin.id, plugin.parent),
            enabled: false,
            source: Object.freeze({ kind: 'runtime' as const, path: null }),
            metadata: inventoryMetadata(plugin.metadata),
            dependencies: Object.freeze([...(plugin.dependencies ?? [])]),
            declarations: null,
          }),
        ),
    ],
    Object.freeze({
      revision: runtime.getRevision(),
      phase: lifecycle.phase,
      cleanup: lifecycle.cleanup,
      operation: lifecycle.operation,
      plugins: Object.freeze(
        lifecycle.plugins.map(({ id, phase, since }) => Object.freeze({ id, phase, since })),
      ),
      services: Object.freeze(
        lifecycle.services.map(({ id, plugin, phase, since }) =>
          Object.freeze({ id, plugin, phase, since }),
        ),
      ),
      actions: Object.freeze(
        Object.values(runtime.actions.getState().actions)
          .filter((value) => !value.internal)
          .map(({ id, enabled, visible, pending }) =>
            Object.freeze({
              id,
              plugin: runtime.actionOwner(id) ?? null,
              enabled,
              visible,
              pending,
            }),
          ),
      ),
      slots: Object.freeze(
        runtime.modules.flatMap((module) =>
          module.slots.map((slot) => {
            const { id, phase, items } = runtime.slots.get(slot.id);
            return Object.freeze({
              id,
              plugin: module.id,
              phase,
              count: items.length,
              mountedOutlets: null,
              visibleCount: null,
              renderFailures: null,
            });
          }),
        ),
      ),
    }),
  );
}

/** Stable read snapshots for React/external-store consumers; this caches diagnostics, never app values. */
export function observeRuntimeInventory(runtime: BitaKitRuntime) {
  let previous: unknown[] = [],
    snapshot: RuntimeInventory;
  const get = () => {
    const inputs = [
      runtime.modules,
      runtime.lifecycle.get(),
      runtime.actions.getState(),
      ...runtime.modules.flatMap((module) =>
        module.slots.map((slot) => runtime.slots.get(slot.id)),
      ),
    ];
    if (
      !snapshot ||
      inputs.length !== previous.length ||
      inputs.some((value, index) => value !== previous[index])
    ) {
      previous = inputs;
      snapshot = inspectRuntime(runtime);
    }
    return snapshot;
  };
  const subscribe = (listener: () => void) => {
    const off = [
      runtime.lifecycle.subscribe(listener),
      runtime.actions.subscribe(listener),
      runtime.events.on('runtime.slot', listener),
    ];
    return () => off.forEach((release) => release());
  };
  return { get, subscribe };
}
