import { resolveName } from '../name-resolution.js';
import type { Events, EventHandler, EventErrorHandler, BitaKitEvent } from './types.js';
import type { EventsDefinition } from './define.js';
import type { RequestContext } from '../request-context.js';

type Listener = (event: BitaKitEvent, ctx?: RequestContext) => void | Promise<void>;
type Declared = {
  plugin: string;
  names: string[];
  cancelable: Set<string>;
  schemas: Map<string, { parse(input: unknown): unknown }>;
};
/**
 * Name lookups derived from the declarations. Built on first use and dropped whenever a name is
 * declared, released or reserved (in server mode that set is fixed after boot), so an emit costs
 * map lookups and the prefix scan, not a pass over every declared name per listener.
 */
type Lookup = {
  /** What `resolve` folds against: reserved events and declared event names. */
  readonly names: readonly string[];
  /** Declared and reserved namespaces. */
  readonly namespaces: readonly string[];
  readonly events: Map<string, string>;
  readonly owners: Map<string, string>;
  /** Exact listener sets by the name their key resolves to; dropped when a key is added or removed. */
  exact?: {
    readonly byName: ReadonlyMap<string, readonly Set<Listener>[]>;
    /** Keys that no longer resolve (ambiguous); reported on every emit, as before. */
    readonly failures: readonly unknown[];
  };
};
/** Cached resolutions are per declaration state; the cap bounds dynamic names between changes. */
const cacheLimit = 1024;
function cached(cache: Map<string, string>, name: string, candidates: readonly string[]) {
  let resolved = cache.get(name);
  if (resolved === undefined) {
    resolved = resolveName(name, candidates);
    if (cache.size >= cacheLimit) cache.clear();
    cache.set(name, resolved);
  }
  return resolved;
}

/**
 * One bus per runtime. Delivery is synchronous and ordered; async handlers are awaited only
 * for error reporting, or fully for cancelable events. Declared namespaces belong to the
 * plugin that declared them: nobody else may emit into them.
 */
export class EventService implements Events {
  private exact = new Map<string, Set<Listener>>();
  private prefixes = new Map<string, Set<Listener>>();
  private subscriptions = new Set<() => void>();
  private observers = new Set<(event: BitaKitEvent) => void>();
  private declared = new Map<string, Declared>();
  private reserved = new Set<string>();
  private reservedEvents = new Set<string>();
  private lookupCache?: Lookup;
  constructor(
    private onError: EventErrorHandler = (error, event) => {
      console.error(`Event handler failed for "${event.type}".`, error);
    },
  ) {}

  /** Registers a plugin's `events.ts`; its names live under `<plugin>.`. */
  declare(plugin: string, definition: EventsDefinition) {
    if (this.reserved.has(plugin))
      throw new Error(`Event namespace "${plugin}" is reserved by the runtime.`);
    const existing = this.declared.get(plugin);
    if (existing)
      throw new Error(`Plugin "${plugin}" declares its events twice. Keep one events.ts.`);
    const cancelable = new Set<string>();
    const schemas = new Map<string, { parse(input: unknown): unknown }>();
    for (const [name, spec] of Object.entries(definition.events)) {
      if (spec.cancelable) cancelable.add(`${plugin}.${name}`);
      if (spec.schema) schemas.set(`${plugin}.${name}`, spec.schema);
    }
    this.declared.set(plugin, {
      plugin,
      names: Object.keys(definition.events).map((name) => `${plugin}.${name}`),
      cancelable,
      schemas,
    });
    this.lookupCache = undefined;
  }
  /** Release a stopped owner’s declaration without removing other owners’ listeners. */
  undeclare(plugin: string) {
    this.declared.delete(resolveName(plugin, this.declared.keys()));
    this.lookupCache = undefined;
  }

  private get lookup(): Lookup {
    return (this.lookupCache ??= {
      names: [
        ...this.reservedEvents,
        ...[...this.declared.values()].flatMap((entry) => entry.names),
      ],
      namespaces: [...this.declared.keys(), ...this.reserved],
      events: new Map(),
      owners: new Map(),
    });
  }
  /** The declared or reserved namespace a (case-folded) namespace reference names. */
  private namespace(name: string): string {
    const lookup = this.lookup;
    return cached(lookup.owners, name, lookup.namespaces);
  }

  /** The plugin that declared the namespace of an event name, if any. */
  ownerOf(name: string): string | undefined {
    const prefix = this.namespace(name.split('.')[0]);
    return this.declared.has(prefix) ? prefix : undefined;
  }
  resolve(name: string): string {
    const lookup = this.lookup;
    return cached(lookup.events, name, lookup.names);
  }
  isCancelable(name: string) {
    name = this.resolve(name);
    return this.declared.get(name.split('.')[0])?.cancelable.has(name) ?? false;
  }

  /** Reserves a runtime-owned namespace and returns its private publishing capability. */
  reserve(namespace: string): (name: string, data: unknown) => void {
    if (this.declared.has(namespace) || this.reserved.has(namespace))
      throw new Error(`Event namespace "${namespace}" is already owned.`);
    this.reserved.add(namespace);
    this.lookupCache = undefined;
    return (name, data) => {
      if (!name.startsWith(`${namespace}.`))
        throw new Error('Event is outside the reserved namespace.');
      if (!this.reservedEvents.has(name)) {
        this.reservedEvents.add(name);
        this.lookupCache = undefined;
      }
      this.dispatch(name, data);
    };
  }

  emit = ((name: string, data?: unknown) =>
    this.emitWithContext(undefined, name, data)) as Events['emit'];

  /**
   * Emits on behalf of a server call: listeners receive `ctx` as `{ signal, ctx }`. It is never
   * part of the event object. `undefined` behaves exactly like `emit`.
   */
  emitWithContext(ctx: RequestContext | undefined, name: string, data?: unknown) {
    if (this.reserved.has(this.namespace(name.split('.')[0])))
      throw new Error(`Event "${name}" is emitted only by the runtime.`);
    return this.dispatch(name, data, ctx);
  }

  private dispatch = (
    name: string,
    data?: unknown,
    ctx?: RequestContext,
  ): void | Promise<boolean> => {
    name = this.resolve(name);
    const schema = this.declared.get(name.split('.')[0])?.schemas.get(name);
    if (this.isCancelable(name)) {
      // Cancelable emits return a promise, so an invalid payload rejects it instead of throwing.
      let checked: unknown;
      try {
        checked = schema ? schema.parse(data) : data;
      } catch (error) {
        return Promise.reject(error);
      }
      return this.emitCancelable(name, checked, ctx);
    }
    const payload = schema ? schema.parse(data) : data;
    const event = Object.freeze({ type: name, data: payload }) as BitaKitEvent;
    for (const listener of this.listenersFor(name)) {
      try {
        const result = listener(event, ctx);
        if (result && typeof (result as Promise<void>).then === 'function')
          void (result as Promise<void>).catch((error) => this.report(error, event));
      } catch (error) {
        this.report(error, event);
      }
    }
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (error) {
        console.error('Event observer failed.', error);
      }
    }
  };

  private async emitCancelable(
    name: string,
    data: unknown,
    ctx?: RequestContext,
  ): Promise<boolean> {
    let cancelled = false;
    const event = Object.freeze({
      type: name,
      data,
      cancel: () => {
        cancelled = true;
      },
      get cancelled() {
        return cancelled;
      },
    }) as BitaKitEvent;
    const pending: Promise<void>[] = [];
    for (const listener of this.listenersFor(name)) {
      try {
        const result = listener(event, ctx);
        if (result && typeof (result as Promise<void>).then === 'function')
          pending.push((result as Promise<void>).catch((error) => this.report(error, event)));
      } catch (error) {
        this.report(error, event);
      }
    }
    await Promise.all(pending);
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (error) {
        console.error('Event observer failed.', error);
      }
    }
    return !cancelled;
  }

  /** Exact listeners (in subscription order), then prefix listeners; each listener once. */
  private listenersFor(name: string): Listener[] {
    const lookup = this.lookup;
    const exact = (lookup.exact ??= this.indexExact());
    const failed = (error: unknown) =>
      this.report(error, Object.freeze({ type: name, data: undefined }));
    exact.failures.forEach(failed);
    const result: Listener[] = [];
    for (const listeners of exact.byName.get(name) ?? []) result.push(...listeners);
    for (const [prefix, listeners] of this.prefixes) {
      try {
        if (name.startsWith(prefix ? `${this.namespace(prefix.slice(0, -1))}.` : ''))
          result.push(...listeners);
      } catch (error) {
        failed(error);
      }
    }
    return [...new Set(result)];
  }
  private indexExact(): NonNullable<Lookup['exact']> {
    const byName = new Map<string, Set<Listener>[]>();
    const failures: unknown[] = [];
    for (const [requested, listeners] of this.exact) {
      let name: string;
      try {
        name = this.resolve(requested);
      } catch (error) {
        failures.push(error);
        continue;
      }
      const sets = byName.get(name);
      if (sets) sets.push(listeners);
      else byName.set(name, [listeners]);
    }
    return { byName, failures };
  }
  private report(error: unknown, event: BitaKitEvent) {
    try {
      this.onError(error, event);
    } catch (reportError) {
      console.error('Event error reporter failed.', reportError);
    }
  }

  on = ((names: string | readonly string[], handler: EventHandler) => {
    const controller = new AbortController();
    const keys = [...new Set(typeof names === 'string' ? [names] : names)];
    for (const name of keys) {
      if (name.endsWith('.*')) this.namespace(name.slice(0, -2));
      else if (name !== '*') this.resolve(name);
    }
    const invoke: Listener = (event, ctx) => {
      if (controller.signal.aborted) return;
      return handler(
        event as never,
        ctx === undefined ? { signal: controller.signal } : { signal: controller.signal, ctx },
      );
    };
    const targets: { map: Map<string, Set<Listener>>; key: string }[] = keys.map((key) =>
      key.endsWith('.*')
        ? { map: this.prefixes, key: key.slice(0, -1) }
        : key === '*'
          ? { map: this.prefixes, key: '' }
          : { map: this.exact, key },
    );
    for (const { map, key } of targets) {
      let set = map.get(key);
      if (!set) {
        map.set(key, (set = new Set()));
        if (map === this.exact && this.lookupCache) this.lookupCache.exact = undefined;
      }
      set.add(invoke);
    }
    const unsubscribe = () => {
      if (controller.signal.aborted) return;
      for (const { map, key } of targets) {
        const set = map.get(key);
        set?.delete(invoke);
        if (set && !set.size) {
          map.delete(key);
          if (map === this.exact && this.lookupCache) this.lookupCache.exact = undefined;
        }
      }
      this.subscriptions.delete(unsubscribe);
      controller.abort();
    };
    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }) as Events['on'];

  /** Diagnostics only: receives every event after delivery. It cannot change or stop delivery. */
  observe(listener: (event: BitaKitEvent) => void) {
    this.observers.add(listener);
    return () => {
      this.observers.delete(listener);
    };
  }
  /** Diagnostics for lifecycle tests; counts `on` calls, not individual event names. */
  get subscriptionCount() {
    return this.subscriptions.size;
  }
  clear() {
    for (const unsubscribe of [...this.subscriptions]) unsubscribe();
    this.exact.clear();
    this.prefixes.clear();
    this.observers.clear();
    this.declared.clear();
    this.lookupCache = undefined;
  }
}

/**
 * A scoped view for one module: releases its listeners on disposal and may emit only into
 * namespaces it owns or that nobody declared.
 */
export function createEventScope(events: EventService, owner?: string) {
  let active = true;
  const cleanups = new Set<() => void>();
  const emitter = (ctx: RequestContext | undefined) =>
    ((name: string, data?: unknown) => {
      if (!active) return undefined as never;
      const declaredBy = events.ownerOf(name);
      if (
        owner !== undefined &&
        declaredBy !== undefined &&
        declaredBy !== (events.ownerOf(`${owner}.__owner`) ?? owner)
      )
        throw new Error(
          `"${owner}" cannot emit "${name}": that event belongs to plugin "${declaredBy}". Only the declaring plugin emits its events; listen with events.on instead.`,
        );
      return events.emitWithContext(ctx, name, data);
    }) as Events['emit'];
  const scoped: Events = {
    emit: emitter(undefined),
    on: ((names, handler) => {
      if (!active) throw new Error('Event scope is no longer active.');
      const unsubscribe = events.on(names as never, handler as never);
      const release = () => {
        cleanups.delete(release);
        unsubscribe();
      };
      cleanups.add(release);
      return release;
    }) as Events['on'],
  };
  return {
    events: scoped,
    /** The same view whose `emit` hands a server call's `ctx` to listeners. */
    withContext: (ctx: RequestContext): Events => ({ emit: emitter(ctx), on: scoped.on }),
    dispose() {
      if (!active) return;
      active = false;
      for (const release of [...cleanups]) release();
      cleanups.clear();
    },
  };
}
