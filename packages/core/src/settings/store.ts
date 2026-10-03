import { parseSetting, type SettingSpec } from './define.js';
import type { SettingsContext, SettingsStorage, StoredSetting } from './storage.js';
import { schemaErrorMessage } from '../schema.js';

export type SettingState<T = unknown> = Readonly<{
  value: T;
  /** A stored value (or the confirmed absence of one) has been loaded for the current identity. */
  ready: boolean;
  writable: boolean;
  /** A write is queued or in flight. */
  pending: boolean;
  error?: string;
}>;
/** "saved" once confirmed, "superseded" when a newer value replaced this one before it was sent, "cancelled" when the identity changed. */
export type SaveResult = 'saved' | 'superseded' | 'cancelled';
export type SettingsIdentity = { readonly userId?: string; readonly organizationId?: string };
export type SettingEntry = {
  readonly key: string;
  readonly plugin: string;
  readonly name: string;
  readonly spec: SettingSpec<any>;
};

type Write = { kind: 'save'; value: unknown } | { kind: 'reset' };
type Waiter = { resolve(result: SaveResult): void; reject(error: unknown): void };
type Slot = {
  entry: SettingEntry;
  state: SettingState;
  readonly initial: SettingState;
  loadToken: number;
  queued?: { write: Write; waiters: Waiter[] };
  flying: boolean;
  superseded: Waiter[];
  listeners: Set<() => void>;
};
const message = (error: unknown, fallback: string) => schemaErrorMessage(error, fallback);
/** Starts storage work synchronously and turns a synchronous throw into a rejection. */
function attempt<T>(run: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * The one owner of setting values: loads them per identity, queues writes (one in flight per
 * key, newer values replace queued ones) and notifies subscribers. Headless; `useSetting`
 * and the `settings` context are views onto it.
 */
export class SettingsStore {
  private readonly slots = new Map<string, Slot>();
  private readonly listeners = new Set<() => void>();
  private identity: SettingsIdentity = Object.freeze({});
  private generation = 0;
  private active = false;
  constructor(
    entries: readonly SettingEntry[],
    private readonly storage: () => SettingsStorage,
  ) {
    for (const entry of entries) {
      if (this.slots.has(entry.key)) throw new Error(`Duplicate setting "${entry.key}".`);
      const initial = Object.freeze({
        value: entry.spec.default,
        ready: false,
        writable: false,
        pending: false,
      });
      this.slots.set(entry.key, {
        entry,
        state: initial,
        initial,
        loadToken: 0,
        flying: false,
        superseded: [],
        listeners: new Set(),
      });
    }
  }

  /** Every declared setting, in declaration order. */
  entries(): readonly SettingEntry[] {
    return [...this.slots.values()].map((slot) => slot.entry);
  }
  has(key: string): boolean {
    return this.slots.has(key);
  }
  definition(key: string): SettingEntry {
    return this.slot(key).entry;
  }
  get isActive(): boolean {
    return this.active;
  }
  get currentIdentity(): SettingsIdentity {
    return this.identity;
  }
  /** The storage context of one key under the current identity. */
  context(key: string): SettingsContext {
    const { scope } = this.slot(key).entry.spec;
    return Object.freeze({
      scope,
      userId: this.identity.userId,
      organizationId: this.identity.organizationId,
    });
  }
  state<T = unknown>(key: string): SettingState<T> {
    return this.slot(key).state as SettingState<T>;
  }
  /** The state before anything loaded; stable per key, for server snapshots. */
  initialState<T = unknown>(key: string): SettingState<T> {
    return this.slot(key).initial as SettingState<T>;
  }
  get<T = unknown>(key: string): T {
    return this.state<T>(key).value;
  }
  /** Validates a value against the declaration without storing it. */
  parse<T = unknown>(key: string, value: unknown): T {
    const { spec } = this.slot(key).entry;
    return parseSetting(spec as SettingSpec<T>, value, key);
  }
  /** Subscribes to one key, or to every change when only a listener is given. */
  subscribe(listener: () => void): () => void;
  subscribe(key: string, listener: () => void): () => void;
  subscribe(keyOrListener: string | (() => void), maybe?: () => void): () => void {
    if (typeof keyOrListener === 'function') {
      this.listeners.add(keyOrListener);
      return () => {
        this.listeners.delete(keyOrListener);
      };
    }
    const listener = maybe!;
    const slot = this.slot(keyOrListener);
    slot.listeners.add(listener);
    return () => {
      slot.listeners.delete(listener);
    };
  }

  /** Loads every value for an identity. Queued writes of the previous identity resolve "cancelled". */
  async activate(identity: SettingsIdentity = {}): Promise<void> {
    this.active = true;
    this.identity = Object.freeze({
      userId: identity.userId,
      organizationId: identity.organizationId,
    });
    const generation = ++this.generation;
    const slots = [...this.slots.values()];
    for (const slot of slots) {
      this.cancel(slot);
      this.publish(slot, slot.initial);
    }
    await this.loadAll(slots, generation);
  }
  /** Keeps the last values but marks nothing ready or writable until the next activation. */
  deactivate() {
    this.active = false;
    ++this.generation;
    for (const slot of this.slots.values()) {
      this.cancel(slot);
      this.publish(slot, {
        value: slot.state.value,
        ready: false,
        writable: false,
        pending: false,
      });
    }
  }
  /** Reloads one key, or every key, for the current identity. */
  async refresh(key?: string): Promise<void> {
    if (!this.active) return;
    const slots = key ? [this.slot(key)] : [...this.slots.values()];
    await this.loadAll(
      slots.filter((slot) => !slot.state.pending),
      this.generation,
    );
  }
  /** Validates and queues a write; rejects only on validation or this value's own storage failure. */
  set(key: string, value: unknown): Promise<SaveResult> {
    try {
      const slot = this.writable(key);
      return this.enqueue(slot, { kind: 'save', value: this.parse(key, value) });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /** Removes the stored value (`storage.reset`) or, without it, saves the default. */
  reset(key: string): Promise<SaveResult> {
    try {
      return this.enqueue(this.writable(key), { kind: 'reset' });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private slot(key: string): Slot {
    const slot = this.slots.get(key);
    if (!slot) {
      const plugin = key.includes('.') ? `plugin "${key.slice(0, key.indexOf('.'))}"` : 'the app';
      throw new Error(`Unknown setting "${key}". Declare it in settings.ts of ${plugin}.`);
    }
    return slot;
  }
  private writable(key: string): Slot {
    const slot = this.slot(key);
    if (!this.active || !slot.state.ready) throw new Error(`Setting "${key}" is not loaded yet.`);
    if (!slot.state.writable) throw new Error(`Setting "${key}" is read-only.`);
    return slot;
  }
  private publish(slot: Slot, state: SettingState) {
    slot.state = Object.freeze({ ...state });
    for (const listener of slot.listeners) listener();
    for (const listener of this.listeners) listener();
  }
  private cancel(slot: Slot) {
    const queued = slot.queued;
    slot.queued = undefined;
    queued?.waiters.forEach((waiter) => waiter.resolve('cancelled'));
    slot.superseded.splice(0).forEach((waiter) => waiter.resolve('superseded'));
  }
  private async loadAll(slots: readonly Slot[], generation: number) {
    if (!slots.length) return;
    let storage: SettingsStorage;
    try {
      storage = this.storage();
    } catch (error) {
      if (generation !== this.generation) return;
      for (const slot of slots)
        this.publish(slot, { ...slot.initial, error: message(error, 'Loading failed.') });
      return;
    }
    const requests = slots.map((slot) => ({
      key: slot.entry.key,
      context: this.context(slot.entry.key),
    }));
    const loadMany = storage.loadMany;
    if (!loadMany) {
      await Promise.all(slots.map((slot) => this.load(slot, generation, storage)));
      return;
    }
    const batch = attempt(() => loadMany.call(storage, requests));
    await Promise.all(
      slots.map((slot, index) =>
        this.load(
          slot,
          generation,
          storage,
          batch.then((results) =>
            Object.hasOwn(results, slot.entry.key)
              ? results[slot.entry.key]!
              : storage.load(slot.entry.key, requests[index].context),
          ),
        ),
      ),
    );
  }
  private async load(
    slot: Slot,
    generation: number,
    storage: SettingsStorage,
    request?: Promise<StoredSetting>,
  ) {
    const token = ++slot.loadToken;
    const fresh = () => generation === this.generation && slot.loadToken === token;
    const { key, spec } = slot.entry;
    try {
      const stored = await (request ?? attempt(() => storage.load(key, this.context(key))));
      if (!fresh()) return;
      let value: unknown = spec.default;
      let error: string | undefined;
      try {
        value = stored.value === undefined ? spec.default : parseSetting(spec, stored.value, key);
      } catch (failure) {
        error = message(failure, 'The stored value is invalid.');
      }
      this.publish(slot, { value, ready: true, writable: stored.writable, pending: false, error });
    } catch (failure) {
      if (!fresh()) return;
      this.publish(slot, { ...slot.initial, error: message(failure, 'Loading failed.') });
    }
  }
  private enqueue(slot: Slot, write: Write): Promise<SaveResult> {
    return new Promise<SaveResult>((resolve, reject) => {
      if (slot.queued) slot.superseded.push(...slot.queued.waiters);
      slot.queued = { write, waiters: [{ resolve, reject }] };
      this.publish(slot, { ...slot.state, pending: true, error: undefined });
      if (!slot.flying) void this.drain(slot, this.generation);
    });
  }
  private async drain(slot: Slot, generation: number) {
    slot.flying = true;
    const { key, spec } = slot.entry;
    while (slot.queued && generation === this.generation) {
      const { write, waiters } = slot.queued;
      slot.queued = undefined;
      // A load that is still in flight must not overwrite the value this write confirms.
      slot.loadToken++;
      const context = this.context(key);
      const { writable } = slot.state;
      let stored: StoredSetting | undefined;
      let failure: { error: unknown } | undefined;
      try {
        const storage = this.storage();
        stored =
          write.kind === 'save'
            ? await attempt(() => storage.save(key, write.value, context)).then(() => ({
                value: write.value,
                writable,
              }))
            : storage.reset
              ? await attempt(() => storage.reset!(key, context))
              : await attempt(() => storage.save(key, spec.default, context)).then(() => ({
                  value: spec.default,
                  writable,
                }));
      } catch (error) {
        failure = { error };
      }
      if (generation !== this.generation) {
        waiters.forEach((waiter) =>
          failure ? waiter.reject(failure.error) : waiter.resolve('cancelled'),
        );
        break;
      }
      if (failure) {
        this.publish(slot, {
          ...slot.state,
          pending: !!slot.queued,
          error: message(failure.error, 'Saving failed.'),
        });
        const { error } = failure;
        waiters.forEach((waiter) => waiter.reject(error));
        continue;
      }
      let value: unknown = slot.state.value;
      try {
        value = stored!.value === undefined ? spec.default : parseSetting(spec, stored!.value, key);
      } catch (error) {
        failure = { error };
      }
      if (failure) {
        this.publish(slot, {
          ...slot.state,
          pending: !!slot.queued,
          error: message(failure.error, 'The stored value is invalid.'),
        });
        const { error } = failure;
        waiters.forEach((waiter) => waiter.reject(error));
        continue;
      }
      this.publish(slot, {
        value,
        ready: true,
        writable: stored!.writable,
        pending: !!slot.queued,
        error: undefined,
      });
      waiters.forEach((waiter) => waiter.resolve('saved'));
    }
    slot.flying = false;
    // Activation may queue a new identity's write while this generation is still saving.
    // Its enqueue could not start a drain until the old storage call released the slot.
    if (slot.queued) void this.drain(slot, this.generation);
    else slot.superseded.splice(0).forEach((waiter) => waiter.resolve('superseded'));
  }
}
