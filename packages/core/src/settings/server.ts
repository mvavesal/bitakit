import type { Namespace } from '../app/types.js';
import type { RequestContext } from '../request-context.js';
import { parseSetting, type SettingSpec, type SettingsMap } from './define.js';
import type { SettingHandle } from './access.js';
import type { SettingsContext, SettingsStorage } from './storage.js';

/**
 * A setting on the server: values are loaded per request, never held in process memory. In an
 * operation `load()` uses the call's `ctx`; services and listeners pass theirs: `load(ctx)`.
 */
export type ServerSettingHandle<T = unknown> = {
  readonly key: string;
  readonly definition: SettingSpec<T>;
  load(ctx?: RequestContext): Promise<T>;
};
export type ServerSettingsAccess = Namespace<{
  [K in keyof SettingsMap]: ServerSettingHandle<SettingsMap[K]>;
}>;

const clientOnly = (key: string) => () => {
  throw new Error(
    `Setting "${key}" has no process-wide value on the server; use await settings.${key}.load().`,
  );
};

/**
 * The handle the runtime builds in server mode. The storage is never called without the owner
 * ID the setting's scope needs: without it, `load` answers the declared default. `storage`
 * returns the `settings.storage` provider, or undefined when none is installed.
 */
export function serverSettingHandle(
  key: string,
  definition: SettingSpec<any>,
  storage: () => SettingsStorage | undefined,
): SettingHandle & ServerSettingHandle {
  const unsupported = clientOnly(key);
  const handle = Object.freeze({
    key,
    definition,
    get: unsupported,
    state: unsupported,
    set: unsupported,
    reset: unsupported,
    subscribe: unsupported,
    load: (ctx?: RequestContext) => loadSetting(key, definition, storage, ctx),
  });
  serverHandles.add(handle);
  return handle as unknown as SettingHandle & ServerSettingHandle;
}
/** Leaves of the server access; namespaces are Proxies that throw on unknown names. */
const serverHandles = new WeakSet<object>();

async function loadSetting(
  key: string,
  spec: SettingSpec<any>,
  storage: () => SettingsStorage | undefined,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  if (!ctx || typeof ctx !== 'object')
    throw new Error(
      `Setting "${key}" needs the request context outside an operation: settings.${key}.load(ctx).`,
    );
  if (spec.scope === 'device')
    throw new Error(
      `Setting "${key}" belongs to the browser (scope "device"); the server cannot load it.`,
    );
  const scope = spec.scope ?? 'user';
  const userId = typeof ctx.user?.id === 'string' && ctx.user.id ? ctx.user.id : undefined;
  const organizationId =
    typeof ctx.organization?.id === 'string' && ctx.organization.id
      ? ctx.organization.id
      : undefined;
  // Never ask the storage without the owner: an undefined ID can drop a tenant filter.
  if ((scope === 'user' && !userId) || (scope === 'organization' && !organizationId))
    return spec.default;
  const provider = storage();
  if (!provider)
    throw new Error(
      `Setting "${key}" cannot load: no service provides settings.storage. Add a server service with provides: settingsStorage.`,
    );
  const context: SettingsContext = Object.freeze({
    scope,
    ...(userId ? { userId } : {}),
    ...(organizationId ? { organizationId } : {}),
  });
  const stored = await provider.load(key, context);
  if (stored?.value === undefined) return spec.default;
  try {
    return parseSetting(spec, stored.value, key);
  } catch (error) {
    console.warn(
      `[bitakit] The stored value of setting "${key}" is invalid; using the default.`,
      error,
    );
    return spec.default;
  }
}

const reserved = new Set(['then', 'toJSON', 'constructor', '__proto__']);
/**
 * The `settings` an operation receives: the same namespaces, with `load()` defaulting to the
 * call's `ctx`. A lazy Proxy over the server access, so building it per call costs nothing.
 */
export function bindSettings(access: object, ctx: RequestContext): ServerSettingsAccess {
  const bound = new Map<object, object>();
  const wrap = (node: object): object => {
    let view = bound.get(node);
    if (view) return view;
    if (serverHandles.has(node)) {
      const handle = node as ServerSettingHandle;
      view = Object.freeze({
        key: handle.key,
        definition: handle.definition,
        load: (other?: RequestContext) => handle.load(other ?? ctx),
      });
    } else
      view = new Proxy(node, {
        get: (target, name) => {
          if (typeof name !== 'string' || reserved.has(name)) return undefined;
          const value = Reflect.get(target, name) as unknown;
          return value && typeof value === 'object' ? wrap(value) : value;
        },
        set: () => false,
        defineProperty: () => false,
        deleteProperty: () => false,
      });
    bound.set(node, view);
    return view;
  };
  return wrap(access) as ServerSettingsAccess;
}
