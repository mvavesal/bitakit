import { serviceKey } from '../service-key.js';
import type { SettingScope } from './define.js';

/** Who a stored value belongs to. Storage decides how to key and authorize it. */
export type SettingsContext = {
  readonly scope: SettingScope;
  readonly userId?: string;
  readonly organizationId?: string;
};
/** `value` undefined means "no stored value, use the default". */
export type StoredSetting = { value: unknown; writable: boolean };
export type SettingsLoadRequest = { key: string; context: SettingsContext };
export interface SettingsStorage {
  load(key: string, context: SettingsContext): StoredSetting | Promise<StoredSetting>;
  save(key: string, value: unknown, context: SettingsContext): void | Promise<void>;
  /** Optional batch load; keys missing from the result are loaded individually. */
  loadMany?(requests: readonly SettingsLoadRequest[]): Promise<Record<string, StoredSetting>>;
  /** Removes the stored value. Without it, a reset saves the default. */
  reset?(key: string, context: SettingsContext): StoredSetting | Promise<StoredSetting>;
}
/**
 * The storage contract. Browser storage is the default; a host persists settings on a server
 * with one service: `defineService(() => ({ load, save }), { provides: settingsStorage })`.
 */
export const settingsStorage = serviceKey<SettingsStorage>('settings.storage');

/** The slot a value lives in, or undefined when the scope has no owner yet. */
export function settingsOwner(context: SettingsContext): string | undefined {
  switch (context.scope) {
    case 'device':
      return 'device';
    case 'user':
      return `user:${context.userId ?? 'anonymous'}`;
    case 'organization':
      return context.organizationId ? `organization:${context.organizationId}` : undefined;
  }
}
const noOrganization = () =>
  new Error('This setting belongs to an organization, but none is active.');

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
/** In-memory storage for tests and servers without persistence. `initial` seeds values by key. */
export function createMemorySettingsStorage(
  initial: Readonly<Record<string, unknown>> = {},
): SettingsStorage & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const slot = (key: string, context: SettingsContext) => {
    const owner = settingsOwner(context);
    return owner ? `${owner}/${key}` : undefined;
  };
  return {
    data,
    load(key, context) {
      const id = slot(key, context);
      if (!id) return { value: undefined, writable: false };
      return { value: data.has(id) ? data.get(id) : initial[key], writable: true };
    },
    save(key, value, context) {
      const id = slot(key, context);
      if (!id) throw noOrganization();
      data.set(id, value);
    },
    reset(key, context) {
      const id = slot(key, context);
      if (!id) throw noOrganization();
      data.delete(id);
      return { value: initial[key], writable: true };
    },
  };
}
function browserStore(): KeyValueStore | undefined {
  try {
    const store = (globalThis as { localStorage?: KeyValueStore }).localStorage;
    if (!store) return undefined;
    const probe = '__bitakit_settings__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return undefined;
  }
}
/** Browser storage keyed by scope owner; falls back to memory where no storage exists. */
export function createLocalSettingsStorage(
  options: { prefix?: string; store?: KeyValueStore } = {},
): SettingsStorage {
  const store = options.store ?? browserStore();
  if (!store) return createMemorySettingsStorage();
  const prefix = options.prefix ?? 'bitakit.settings.';
  const slot = (key: string, context: SettingsContext) => {
    const owner = settingsOwner(context);
    return owner ? `${prefix}${owner}/${key}` : undefined;
  };
  return {
    load(key, context) {
      const id = slot(key, context);
      if (!id) return { value: undefined, writable: false };
      const raw = store.getItem(id);
      if (raw === null) return { value: undefined, writable: true };
      try {
        return { value: JSON.parse(raw), writable: true };
      } catch {
        return { value: undefined, writable: true };
      }
    },
    save(key, value, context) {
      const id = slot(key, context);
      if (!id) throw noOrganization();
      store.setItem(id, JSON.stringify(value));
    },
    reset(key, context) {
      const id = slot(key, context);
      if (!id) throw noOrganization();
      store.removeItem(id);
      return { value: undefined, writable: true };
    },
  };
}
