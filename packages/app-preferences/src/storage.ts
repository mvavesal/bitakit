import type { SettingValue, SettingsContext, SettingsStorage, StoredSetting } from './types.js';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type LocalStorageOptions = {
  /** Namespace prepended to every key, for example "my-app.settings.". */
  prefix: string;
  /** Defaults to window.localStorage. Without a store, values are read-only defaults. */
  store?: KeyValueStore;
  /** Optional per-context segment, for example (context) => context.userId ?? 'guest'. */
  namespace?: (context: SettingsContext) => string | undefined;
};
function browserStore(): KeyValueStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
/**
 * Device-local persistence. Values are JSON encoded; unreadable entries fall back to the default.
 * Write failures (quota, privacy mode) reject, so AppPreferences never confirms them.
 */
export function createLocalStorage(options: LocalStorageOptions): SettingsStorage {
  const name = (key: string, context: SettingsContext) => {
    const segment = options.namespace?.(context);
    return `${options.prefix}${segment ? `${segment}.` : ''}${key}`;
  };
  const read = (key: string, context: SettingsContext): StoredSetting => {
    const store = options.store ?? browserStore();
    if (!store) return { writable: false };
    let value: SettingValue | undefined;
    try {
      const raw = store.getItem(name(key, context));
      const parsed: unknown = raw === null ? undefined : JSON.parse(raw);
      if (
        typeof parsed === 'string' ||
        typeof parsed === 'number' ||
        typeof parsed === 'boolean' ||
        (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string'))
      )
        value = parsed;
    } catch {
      value = undefined;
    }
    return { value, writable: true };
  };
  const required = () => {
    const store = options.store ?? browserStore();
    if (!store) throw new Error('Local storage is not available.');
    return store;
  };
  return {
    async load(key, context) {
      return read(key, context);
    },
    async loadMany(keys, context) {
      return Object.fromEntries(keys.map((key) => [key, read(key, context)]));
    },
    async save(key, value, context) {
      required().setItem(name(key, context), JSON.stringify(value));
    },
    async reset(key, context) {
      required().removeItem(name(key, context));
      return { writable: true };
    },
  };
}
export type MemoryStorageOptions = {
  values?: Readonly<Record<string, SettingValue>>;
  /** Read-only keys or a predicate; everything else is writable. */
  writable?: boolean | ((key: string, context: SettingsContext) => boolean);
};
/** In-memory persistence for tests, previews and prototypes. Not shared between instances. */
export function createMemoryStorage(options: MemoryStorageOptions = {}): SettingsStorage & {
  values: ReadonlyMap<string, SettingValue>;
} {
  const values = new Map(Object.entries(options.values ?? {}));
  const writable = (key: string, context: SettingsContext) =>
    typeof options.writable === 'function'
      ? options.writable(key, context)
      : (options.writable ?? true);
  const read = (key: string, context: SettingsContext): StoredSetting => ({
    value: values.get(key),
    writable: writable(key, context),
  });
  return {
    values,
    async load(key, context) {
      return read(key, context);
    },
    async loadMany(keys, context) {
      return Object.fromEntries(keys.map((key) => [key, read(key, context)]));
    },
    async save(key, value, context) {
      if (!writable(key, context)) throw new Error('Setting is read-only.');
      values.set(key, value);
    },
    async reset(key, context) {
      if (!writable(key, context)) throw new Error('Setting is read-only.');
      values.delete(key);
      return read(key, context);
    },
  };
}
