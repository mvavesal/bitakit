import mitt from 'mitt';
import type { Events, EventHandler, EventErrorHandler, FoundationEvent } from './types.js';

/** One bus per runtime. Mitt owns dispatch; Foundation owns lifetimes and error reporting. */
export class EventService implements Events {
  private bus = mitt<Record<string, FoundationEvent>>();
  private subscriptions = new Set<() => void>();
  constructor(
    private onError: EventErrorHandler = (error, event) => {
      console.error(`Event handler failed for "${event.type}".`, error);
    },
  ) {}

  emit: Events['emit'] = (type, ...payload) => {
    this.bus.emit(`event:${type}`, Object.freeze({ type, data: payload[0] }));
  };

  watch: Events['watch'] = (names, handler) => {
    const controller = new AbortController();
    const keys = [...new Set(typeof names === 'string' ? [names] : names)];
    // Prefix keys to keep mitt's wildcard private; event names are always literal.
    const invoke = (event: FoundationEvent) => {
      if (controller.signal.aborted) return;
      const report = (error: unknown) => {
        try {
          this.onError(error, event);
        } catch (reportError) {
          console.error('Event error reporter failed.', reportError);
        }
      };
      try {
        const result = (handler as EventHandler)(event, { signal: controller.signal });
        if (result) void Promise.resolve(result).catch(report);
      } catch (error) {
        report(error);
      }
    };
    for (const key of keys) this.bus.on(`event:${key}`, invoke);
    const unsubscribe = () => {
      if (controller.signal.aborted) return;
      for (const key of keys) {
        const name = `event:${key}`;
        this.bus.off(name, invoke);
        if (!this.bus.all.get(name)?.length) this.bus.all.delete(name);
      }
      this.subscriptions.delete(unsubscribe);
      controller.abort();
    };
    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  };

  /**
   * Diagnostics only: receives every event after delivery is scheduled, for developer tools such
   * as an event log. It cannot change or stop delivery. Returns the unsubscribe function.
   */
  observe(listener: (event: FoundationEvent) => void) {
    const handler = (type: string, event: FoundationEvent) => {
      if (!type.startsWith('event:')) return;
      try {
        listener(event);
      } catch (error) {
        console.error('Event observer failed.', error);
      }
    };
    this.bus.on('*', handler as never);
    return () => this.bus.off('*', handler as never);
  }

  /** Diagnostics for lifecycle tests; counts watch calls, not individual event names. */
  get subscriptionCount() {
    return this.subscriptions.size;
  }

  clear() {
    for (const unsubscribe of [...this.subscriptions]) unsubscribe();
    this.bus.all.clear();
  }
}

/** A scoped view shares the bus and releases callback references on disposal. */
export function createEventScope(events: Events) {
  let active = true;
  const cleanups = new Set<() => void>();
  const scoped: Events = {
    emit: (name, ...data) => {
      if (active) events.emit(name, ...data);
    },
    watch: (names, handler) => {
      if (!active) throw new Error('Event scope is no longer active.');
      const unsubscribe = events.watch(names, handler);
      const release = () => {
        cleanups.delete(release);
        unsubscribe();
      };
      cleanups.add(release);
      return release;
    },
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
