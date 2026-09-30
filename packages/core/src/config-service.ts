/** Immutable configuration. User preferences continue to belong to AppPreferences. */
export interface ConfigMap {}
export type ConfigValues = Readonly<Record<string, unknown>>;
const configDefinition = Symbol('foundation.config');
export type ConfigSchema<T> = { parse(input: unknown): T };
export type ConfigDefinition<T = ConfigValues> = {
  readonly [configDefinition]: true;
  readonly defaults?: Partial<T>;
  readonly schema?: ConfigSchema<T>;
};
export function defineConfig<T extends ConfigValues>(value: { defaults: T }): ConfigDefinition<T>;
export function defineConfig<T>(value: {
  schema: ConfigSchema<T>;
  defaults?: Partial<T>;
}): ConfigDefinition<T>;
export function defineConfig<T extends ConfigValues>(value: T): T;
export function defineConfig(value: any): any {
  return 'defaults' in value || (value.schema && typeof value.schema.parse === 'function')
    ? { ...value, [configDefinition]: true }
    : value;
}
export function isConfigDefinition(value: unknown): value is ConfigDefinition {
  return !!value && typeof value === 'object' && configDefinition in value;
}
export function isConfigObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function immutable(value: unknown): any {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (isConfigObject(value))
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, item]) => [key, immutable(item)])),
    );
  if ((value !== null && typeof value === 'object') || typeof value === 'function')
    throw new TypeError('Config snapshots require plain objects, arrays and primitive values.');
  return value;
}
function resolve(defaults: unknown, override: unknown): unknown {
  if (isConfigDefinition(defaults))
    return immutable(
      defaults.schema
        ? defaults.schema.parse(resolve(defaults.defaults ?? {}, override))
        : resolve(defaults.defaults ?? {}, override),
    );
  if (isConfigObject(defaults) && (override === undefined || isConfigObject(override))) {
    const extra = (override ?? {}) as Record<string, unknown>;
    return Object.freeze(
      Object.fromEntries(
        [...new Set([...Object.keys(defaults), ...Object.keys(extra)])].map((key) => [
          key,
          resolve(defaults[key], extra[key]),
        ]),
      ),
    );
  }
  return immutable(override === undefined ? defaults : override);
}
export type ConfigPath = string | readonly string[];
export type ConfigAt<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T
      ? ConfigAt<T[Head], Tail>
      : unknown
    : unknown;

export class ConfigScope<T = ConfigValues> {
  constructor(private readonly value: T) {}
  get<P extends string>(path: P): ConfigAt<T, P>;
  get<V>(path: ConfigPath, fallback: V): V;
  get(path: readonly string[]): unknown;
  get(path: ConfigPath, fallback?: unknown): unknown {
    const segments = typeof path === 'string' ? path.split('.') : path;
    let value: unknown = this.value;
    for (const key of segments) {
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return fallback;
      value = (value as Record<string, unknown>)[key];
    }
    return value === undefined ? fallback : value;
  }
  scope<U = ConfigValues>(path: ConfigPath): ConfigScope<U> {
    return new ConfigScope(
      (this.get(typeof path === 'string' ? path.split('.') : path) ?? {}) as U,
    );
  }
  snapshot(): T {
    return this.value;
  }
}
export type ConfigContext = { plugin: ConfigScope; action: ConfigScope };
export class ConfigService {
  private readonly modules = new Map<string, ConfigScope>();
  constructor(
    modules: readonly { id: string; config?: ConfigValues | ConfigDefinition }[],
    overrides: Readonly<Record<string, ConfigValues>> = {},
  ) {
    for (const module of modules) {
      if (this.modules.has(module.id)) throw new Error(`Duplicate config module "${module.id}".`);
      this.modules.set(
        module.id,
        new ConfigScope(resolve(module.config ?? {}, overrides[module.id]) as ConfigValues),
      );
    }
    for (const id of Object.keys(overrides))
      if (!this.modules.has(id)) throw new Error(`Unknown config module "${id}".`);
  }
  plugin<K extends keyof ConfigMap & string>(id: K): ConfigScope<ConfigMap[K]>;
  plugin<T = ConfigValues>(id: string): ConfigScope<T>;
  plugin<T = ConfigValues>(id: string): ConfigScope<T> {
    const scope = this.modules.get(id);
    if (!scope) throw new Error(`Unknown config module "${id}".`);
    return scope as ConfigScope<T>;
  }
  context(id: string, actionPath: readonly string[] = []): ConfigContext {
    const plugin = this.plugin(id);
    return { plugin, action: plugin.scope(['actions', ...actionPath]) };
  }
}
