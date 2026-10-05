import { ActionGroup, type ActionDefinition, type ActionList } from '@bitakit/core/actions';
import type { PluginMetadata, PluginUI, Translator } from './definitions.js';
import type { SettingsDefinition } from './settings/define.js';
import { cleanupSequence, cleanupFailure, type Cleanup } from './lifecycle/cleanup.js';
import type { LifecycleState } from './lifecycle/state.js';
import type { ScopedSlots } from './slots/types.js';

export type ScopeModule = Readonly<{ id: string; app: boolean }>;
/** A plugin as integrations may present it: its ID and metadata, never its services. */
export type ComposedPlugin = Readonly<{ id: string; metadata?: PluginMetadata }>;
/** A composed module with its declarations, for integrations that project them (settings pages, overviews). */
export type ComposedModule = Readonly<{
  id: string;
  app: boolean;
  metadata?: PluginMetadata;
  settings?: SettingsDefinition<any>;
  ui?: PluginUI;
}>;
/** The host's live translation, whichever way it was supplied (`i18n` service or provider prop). */
export type ScopeTranslation = Readonly<{
  translate: Translator;
  /** The translated key when the catalog has it, otherwise the fallback. */
  text(key: string | undefined, fallback: string, values?: Parameters<Translator>[1]): string;
  subscribe(listener: () => void): () => void;
}>;
const compositionReaders = new WeakSet<PluginScope>();
/** Internal: projections that capture composition must be restarted when it changes. */
export const readsComposition = (scope: PluginScope) => compositionReaders.has(scope);
const modules = new WeakMap<PluginScope, ScopeModule>();
const compositions = new WeakMap<PluginScope, readonly ComposedPlugin[]>();
const moduleLists = new WeakMap<PluginScope, readonly ComposedModule[]>();
const lifecycles = new WeakMap<PluginScope, LifecycleState>();
const translations = new WeakMap<PluginScope, ScopeTranslation>();
/**
 * Runtime only: records which module a scope belongs to and the plugins composed with it. Not
 * exported from the package.
 */
export function assignScopeModule(
  scope: PluginScope,
  module: ScopeModule,
  plugins: readonly ComposedPlugin[] = [],
  composed: readonly ComposedModule[] = [],
  translation?: ScopeTranslation,
  lifecycle?: LifecycleState,
) {
  modules.set(scope, Object.freeze({ ...module }));
  compositions.set(scope, plugins);
  moduleLists.set(scope, composed);
  if (translation) translations.set(scope, translation);
  if (lifecycle) lifecycles.set(scope, lifecycle);
}
/**
 * The module that owns a runtime-issued scope. Integrations derive ownership and layer from it,
 * so a plugin cannot register on behalf of the application or another plugin.
 */
export function scopeModule(scope: PluginScope): ScopeModule {
  const module = modules.get(scope);
  if (!module) throw new Error('Unknown plugin scope. Use the scope passed to setup.');
  return module;
}
/**
 * The plugins composed with the runtime that issued a scope, in install order and without the
 * application, for integrations that list or link plugins, such as a plugin overview.
 */
export function scopePlugins(scope: PluginScope): readonly ComposedPlugin[] {
  scopeModule(scope);
  compositionReaders.add(scope);
  return compositions.get(scope) ?? [];
}
/** Every composed module including the app, in install order, with settings and UI declarations. */
export function scopeModules(scope: PluginScope): readonly ComposedModule[] {
  scopeModule(scope);
  compositionReaders.add(scope);
  return moduleLists.get(scope) ?? [];
}
const untranslated: ScopeTranslation = Object.freeze({
  translate: (key: string) => key,
  text: (key, fallback) => (key === undefined ? fallback : fallback),
  subscribe: () => () => {},
});
/** The host translation for projections built in `setup`; follows language changes. */
export function scopeTranslation(scope: PluginScope): ScopeTranslation {
  scopeModule(scope);
  return translations.get(scope) ?? untranslated;
}
/** Runtime status for projections; subscriptions are revoked as soon as this scope closes. */
export function scopeLifecycle(scope: PluginScope): LifecycleState {
  scopeModule(scope);
  const lifecycle = lifecycles.get(scope);
  if (!lifecycle) throw new Error('Lifecycle state requires a runtime-issued scope.');
  const owned = (listen: () => () => void) => {
    let closed = false;
    let off = () => {};
    const release = scope.onClose(() => {
      closed = true;
      off();
    });
    try {
      off = listen();
    } catch (error) {
      release();
      throw error;
    }
    if (closed) off();
    return () => {
      off();
      release();
    };
  };
  return {
    get: lifecycle.get,
    subscribe: (listener) => owned(() => lifecycle.subscribe(listener)),
    watch: (listener) => owned(() => lifecycle.watch(listener)),
  };
}
/** Scoped facade over the host list, never a second action registry. */
export class PluginScope {
  private cleanups: Cleanup[] = [];
  private completion?: Promise<void>;
  private registrations = new Map<string, () => void>();
  private active = true;
  private closeErrors: unknown[] = [];
  private closing = new Set<() => void>();
  private slotBindings?: ScopedSlots;
  constructor(
    private list: ActionList,
    private groups: Map<string, ActionGroup>,
  ) {}
  /** Owned slot access is supplied only by a runtime-issued scope. */
  get slots(): ScopedSlots {
    this.assertActive();
    if (!this.slotBindings) throw new Error('Slots require a runtime-issued plugin scope.');
    return this.slotBindings;
  }
  /** @internal Runtime binding; never a second registration path. */
  bindSlots(slots: ScopedSlots) {
    this.slotBindings = slots;
  }
  /** @internal Invalidate registrations immediately; asynchronous resource cleanup uses own(). */
  onClose(cleanup: () => void): () => void {
    this.assertActive();
    this.closing.add(cleanup);
    return () => {
      this.closing.delete(cleanup);
    };
  }
  own(cleanup: Cleanup) {
    this.assertActive();
    this.cleanups.push(cleanup);
  }
  private assertActive() {
    if (!this.active) throw new Error('Plugin scope is no longer active.');
  }
  actions = {
    getGroup: (id: string) => {
      this.assertActive();
      let group = this.groups.get(id);
      if (!group) {
        group = new ActionGroup(id);
        this.groups.set(id, group);
      }
      return {
        attach: (actionId: string) => {
          this.assertActive();
          const dispose = this.list.attach(actionId, group);
          this.own(dispose);
          return { dispose };
        },
        add: (action: ActionDefinition) => {
          this.assertActive();
          const handle = this.list.register(action, {
            groups: [...(action.groups ?? []), group],
          });
          this.registrations.set(action.id, handle.unregister);
          this.own(handle.unregister);
          return { dispose: handle.unregister, update: handle.update };
        },
      };
    },
  };
  /** Prevent new registrations and cancel owned Action runs before asynchronous teardown. */
  close() {
    this.active = false;
    for (const cleanup of this.closing) {
      try {
        cleanup();
      } catch (error) {
        this.closeErrors.push(error);
      }
    }
    this.closing.clear();
    for (const unregister of this.registrations.values()) {
      try {
        unregister();
      } catch (error) {
        this.closeErrors.push(error);
      }
    }
    this.registrations.clear();
  }
  ownsAction(id: string) {
    return this.registrations.has(id);
  }
  dispose(): Promise<void> {
    if (this.completion) return this.completion;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    this.completion = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    this.close();
    const tasks = this.cleanups.splice(0).reverse();
    void cleanupSequence(tasks, (errors) =>
      cleanupFailure([...this.closeErrors, ...errors], 'Plugin cleanup failed.'),
    ).then(resolve, reject);
    return this.completion;
  }
}
