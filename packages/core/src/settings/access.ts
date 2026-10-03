import type { Namespace } from '../app/types.js';
import type { SettingSpec, SettingsMap } from './define.js';
import type { SaveResult, SettingState, SettingsStore } from './store.js';

/** One setting as every context sees it: `settings.todos.pageSize.get()`. */
export type SettingHandle<T = unknown> = {
  readonly key: string;
  readonly definition: SettingSpec<T>;
  get(): T;
  state(): SettingState<T>;
  set(value: T): Promise<SaveResult>;
  reset(): Promise<SaveResult>;
  subscribe(listener: () => void): () => void;
};
/** Typed handles under plugin namespaces, generated from every `settings.ts`. */
export type SettingsAccess = Namespace<{
  [K in keyof SettingsMap]: SettingHandle<SettingsMap[K]>;
}>;

const reserved = new Set(['then', 'toJSON', 'constructor', '__proto__']);
type Branch = { children: Map<string, Branch>; handle?: SettingHandle; path: string };
/** Builds the handle tree once; reading an undeclared name explains where to declare it. */
export function createSettingsAccess(store: SettingsStore): SettingsAccess {
  const root: Branch = { children: new Map(), path: '' };
  for (const entry of store.entries()) {
    const segments = entry.key.split('.');
    let node = root;
    for (const [index, segment] of segments.entries()) {
      if (reserved.has(segment))
        throw new Error(`Setting "${entry.key}" uses the reserved name "${segment}".`);
      const path = node.path ? `${node.path}.${segment}` : segment;
      let child = node.children.get(segment);
      if (!child) node.children.set(segment, (child = { children: new Map(), path }));
      if (index === segments.length - 1) {
        if (child.children.size)
          throw new Error(
            `Setting "${entry.key}" clashes with the settings of plugin "${path}". Rename the app setting.`,
          );
        child.handle = handle(store, entry.key, entry.spec);
      } else if (child.handle)
        throw new Error(
          `Plugin "${path}" declares settings, but the app also declares a setting named "${path}". Rename the app setting.`,
        );
      node = child;
    }
  }
  const project = (node: Branch): object => {
    const target: Record<string, unknown> = Object.create(null);
    for (const [name, child] of node.children) target[name] = child.handle ?? project(child);
    Object.freeze(target);
    return new Proxy(target, {
      get(object, name) {
        if (typeof name !== 'string' || reserved.has(name) || name in object)
          return Reflect.get(object, name);
        const path = node.path ? `${node.path}.${name}` : name;
        const owner = node.path ? `plugin "${node.path}"` : 'the app or a plugin';
        throw new Error(`Unknown setting "${path}". Declare it in settings.ts of ${owner}.`);
      },
      set: () => false,
      defineProperty: () => false,
      deleteProperty: () => false,
    });
  };
  return project(root) as SettingsAccess;
}
function handle(store: SettingsStore, key: string, definition: SettingSpec<any>): SettingHandle {
  return Object.freeze({
    key,
    definition,
    get: () => store.get(key),
    state: () => store.state(key),
    set: (value: unknown) => store.set(key, value),
    reset: () => store.reset(key),
    subscribe: (listener: () => void) => store.subscribe(key, listener),
  });
}
