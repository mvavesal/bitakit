import { ActionGroup, type ActionDefinition, type ActionList } from '@bitakit/core/actions';
import type { PluginMetadata, PluginUI, Translator } from './definitions.js';
import type { SettingsDefinition } from './settings/define.js';

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
const modules = new WeakMap<PluginScope, ScopeModule>();
const compositions = new WeakMap<PluginScope, readonly ComposedPlugin[]>();
const moduleLists = new WeakMap<PluginScope, readonly ComposedModule[]>();
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
) {
  modules.set(scope, Object.freeze({ ...module }));
  compositions.set(scope, plugins);
  moduleLists.set(scope, composed);
  if (translation) translations.set(scope, translation);
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
/** Every composed module including the app, in install order, with settings and UI declarations. */
export function scopeModules(scope: PluginScope): readonly ComposedModule[] {
  scopeModule(scope);
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
