import type { Events, EventHandler, EventErrorHandler, BitaKitEvent } from './types.js';
import type { EventsDefinition } from './define.js';

type Listener = (event: BitaKitEvent) => void | Promise<void>;
type Declared = {
  plugin: string;
  cancelable: Set<string>;
  schemas: Map<string, { parse(input: unknown): unknown }>;
};

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
    this.declared.set(plugin, { plugin, cancelable, schemas });
  }
  /** Release a stopped owner’s declaration without removing other owners’ listeners. */
  undeclare(plugin: string) {
    this.declared.delete(plugin);
  }

  /** The plugin that declared the namespace of an event name, if any. */
  ownerOf(name: string): string | undefined {
    const prefix = name.split('.')[0];
    return this.declared.has(prefix) ? prefix : undefined;
  }
  isCancelable(name: string) {
    return this.declared.get(name.split('.')[0])?.cancelable.has(name) ?? false;
  }

  /** Reserves a runtime-owned namespace and returns its private publishing capability. */
  reserve(namespace: string): (name: string, data: unknown) => void {
    if (this.declared.has(namespace) || this.reserved.has(namespace))
      throw new Error(`Event namespace "${namespace}" is already owned.`);
    this.reserved.add(namespace);
    return (name, data) => {
      if (!name.startsWith(`${namespace}.`))
        throw new Error('Event is outside the reserved namespace.');
      this.dispatch(name, data);
    };
  }

  emit = ((name: string, data?: unknown) => {
    if (this.reserved.has(name.split('.')[0]))
      throw new Error(`Event "${name}" is emitted only by the runtime.`);
    return this.dispatch(name, data);
  }) as Events['emit'];

  private dispatch = (name: string, data?: unknown): void | Promise<boolean> => {
    const schema = this.declared.get(name.split('.')[0])?.schemas.get(name);
    if (this.isCancelable(name)) {
      // Cancelable emits return a promise, so an invalid payload rejects it instead of throwing.
      let checked: unknown;
      try {
        checked = schema ? schema.parse(data) : data;
      } catch (error) {
        return Promise.reject(error);
      }
      return this.emitCancelable(name, checked);
    }
    const payload = schema ? schema.parse(data) : data;
    const event = Object.freeze({ type: name, data: payload }) as BitaKitEvent;
    for (const listener of this.listenersFor(name)) {
      try {
        const result = listener(event);
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

  private async emitCancelable(name: string, data: unknown): Promise<boolean> {
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
        const result = listener(event);
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

  private listenersFor(name: string): Listener[] {
    const result = [...(this.exact.get(name) ?? [])];
    for (const [prefix, listeners] of this.prefixes)
      if (name.startsWith(prefix)) result.push(...listeners);
    return result;
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
    const invoke: Listener = (event) => {
      if (controller.signal.aborted) return;
      return handler(event as never, { signal: controller.signal });
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
      if (!set) map.set(key, (set = new Set()));
      set.add(invoke);
    }
    const unsubscribe = () => {
      if (controller.signal.aborted) return;
      for (const { map, key } of targets) {
        const set = map.get(key);
        set?.delete(invoke);
        if (set && !set.size) map.delete(key);
      }
      this.subscriptions.delete(unsubscribe);
      controller.abort();
    };
    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }) as Events['on'];
  /** @deprecated Use `on`. */

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
  }
}

/**
 * A scoped view for one module: releases its listeners on disposal and may emit only into
 * namespaces it owns or that nobody declared.
 */
export function createEventScope(events: EventService, owner?: string) {
  let active = true;
  const cleanups = new Set<() => void>();
  const scoped: Events = {
    emit: ((name: string, ...data: unknown[]) => {
      if (!active) return undefined as never;
      const declaredBy = events.ownerOf(name);
      if (owner !== undefined && declaredBy !== undefined && declaredBy !== owner)
        throw new Error(
          `"${owner}" cannot emit "${name}": that event belongs to plugin "${declaredBy}". Only the declaring plugin emits its events; listen with events.on instead.`,
        );
      return (events.emit as (name: string, ...data: unknown[]) => unknown)(name, ...data);
    }) as Events['emit'],
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
    dispose() {
      if (!active) return;
      active = false;
      for (const release of [...cleanups]) release();
      cleanups.clear();
    },
  };
}
