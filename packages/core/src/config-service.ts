/** Immutable configuration. User preferences belong to settings, not here. */
export interface ConfigMap {}
export type ConfigValues = Readonly<Record<string, unknown>>;
const configDefinition = Symbol.for('bitakit.core.config');

/** zod, valibot and friends: `parse`, or the Standard Schema `~standard.validate` (sync). */
export type ConfigSchema<T> =
  | { parse(input: unknown): T }
  | {
      '~standard': {
        validate(input: unknown): { value: T } | { issues: readonly { message: string }[] };
      };
    };
export type ConfigDefinition<T = ConfigValues> = {
  readonly [configDefinition]: true;
  readonly defaults?: Partial<T>;
  readonly schema?: ConfigSchema<T>;
};
type SchemaOutput<S> = S extends { parse(input: unknown): infer T }
  ? T
  : S extends { '~standard': { validate(input: unknown): infer R } }
    ? Extract<Awaited<R>, { value: unknown }>['value']
    : never;

/** `defineConfig({ defaults })`, `defineConfig({ schema })` or both. Files may also export a plain object. */
export function defineConfig<T extends ConfigValues>(value: {
  defaults: T;
  schema?: undefined;
}): ConfigDefinition<T>;
export function defineConfig<S extends ConfigSchema<any>>(value: {
  schema: S;
  defaults?: Partial<SchemaOutput<S>>;
}): ConfigDefinition<SchemaOutput<S>>;
export function defineConfig(value: {
  defaults?: unknown;
  schema?: unknown;
}): ConfigDefinition<any> {
  if (!value || typeof value !== 'object' || (!('defaults' in value) && !('schema' in value)))
    throw new Error('defineConfig expects { defaults } and/or { schema }.');
  return { ...(value as object), [configDefinition]: true } as ConfigDefinition<any>;
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
function parseWith<T>(schema: ConfigSchema<T>, input: unknown): T {
  if ('parse' in schema) return schema.parse(input);
  const result = schema['~standard'].validate(input);
  if (result && typeof (result as unknown as Promise<unknown>).then === 'function')
    throw new TypeError('Config schemas must validate synchronously.');
  if ('issues' in result)
    throw new Error(`Invalid config: ${result.issues.map((issue) => issue.message).join('; ')}`);
  return result.value;
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
  if (isConfigDefinition(defaults)) {
    const merged = resolve(defaults.defaults ?? {}, override);
    return immutable(defaults.schema ? parseWith(defaults.schema, merged) : merged);
  }
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
/** `plugin`: the module's whole tree. `action`: positioned at `actions.<action path>`. */
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
      if (!this.modules.has(id))
        throw new Error(
          `configOverrides names "${id}", but no plugin with that ID is enabled. Known: ${[...this.modules.keys()].join(', ')}.`,
        );
  }
  /** Adopt prevalidated module scopes without replacing the public configuration service. */
  replace(next: ConfigService) {
    this.modules.clear();
    for (const [id, scope] of next.modules) this.modules.set(id, scope);
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
