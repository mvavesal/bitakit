import { ActionGroup, type ActionDefinition, type ActionList } from '@bitakit/core/actions';

export type ScopeModule = Readonly<{ id: string; app: boolean }>;
const modules = new WeakMap<PluginScope, ScopeModule>();
/** Runtime only: records which module a scope belongs to. Not exported from the package. */
export function assignScopeModule(scope: PluginScope, module: ScopeModule) {
  modules.set(scope, Object.freeze({ ...module }));
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
