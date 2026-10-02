import { ActionGroup, type ActionDefinition, type ActionList } from '@bitakit/core/actions';
import type { PluginMetadata } from './definitions.js';

export type ScopeModule = Readonly<{ id: string; app: boolean }>;
/** A plugin as integrations may present it: its ID and metadata, never its services. */
export type ComposedPlugin = Readonly<{ id: string; metadata?: PluginMetadata }>;
const modules = new WeakMap<PluginScope, ScopeModule>();
const compositions = new WeakMap<PluginScope, readonly ComposedPlugin[]>();
/**
 * Runtime only: records which module a scope belongs to and the plugins composed with it. Not
 * exported from the package.
 */
export function assignScopeModule(
  scope: PluginScope,
  module: ScopeModule,
  plugins: readonly ComposedPlugin[] = [],
) {
  modules.set(scope, Object.freeze({ ...module }));
  compositions.set(scope, plugins);
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
  return compositions.get(scope) ?? [];
}
/** Scoped facade over the host list, never a second action registry. */
export class PluginScope {
  private cleanups: (() => void)[] = [];
  private active = true;
  constructor(
    private list: ActionList,
    private groups: Map<string, ActionGroup>,
  ) {}
  own(cleanup: () => void) {
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
          this.own(handle.unregister);
          return { dispose: handle.unregister, update: handle.update };
        },
      };
    },
  };
  dispose() {
    if (!this.active) return;
    this.active = false;
    const errors: unknown[] = [];
    for (const cleanup of this.cleanups.reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    this.cleanups = [];
    if (errors.length) throw new AggregateError(errors, 'Plugin cleanup failed.');
  }
}
