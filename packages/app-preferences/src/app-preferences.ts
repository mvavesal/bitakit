import type { SettingsSection } from './catalog/section.js';
import { SettingsCatalog } from './catalog/catalog.js';
import type { Setting } from './fields/setting.js';
import { SettingsCollection, settingsOf, type SettingsSource } from './fields/builders.js';
import type {
  Registration,
  SaveResult,
  SettingState,
  SettingValue,
  SettingsContext,
  SettingsStorage,
  StoredSetting,
} from './types.js';

type Write = { kind: 'save'; value: SettingValue } | { kind: 'reset' };
type Waiter = { resolve(result: SaveResult): void; reject(error: unknown): void };
/** Per-context state. A new session replaces the old one on activation, so late responses are dropped. */
type Session = {
  state: SettingState<any>;
  loadToken: number;
  queued?: { write: Write; waiters: Waiter[] };
  flying: boolean;
  superseded: Waiter[];
};
type Entry = {
  setting: Setting<any>;
  /** Owning modules with their registration counts, in registration order. */
  owners: Map<string, number>;
  origin?: string;
  pinned: boolean;
  references: number;
  session: Session;
};
export type RegisterOptions = {
  /** The module that owns the definitions, normally a plugin ID or the app ID. */
  owner: string;
  /** Where the definitions came from, for example a discovered file, used in error messages. */
  origin?: string;
};
const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
/** Starts storage work synchronously and turns a synchronous throw into a rejection. */
function attempt<T>(run: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error);
  }
}
const describe = (entry: { owner?: string; origin?: string }) =>
  entry.origin ?? (entry.owner ? `"${entry.owner}"` : 'the host');
const describeEntry = (entry: Entry) =>
  describe({ origin: entry.origin, owner: [...entry.owners.keys()][0] });

/** Sole owner of confirmed values: registration, scoped loading, queued writes and subscriptions. */
export class AppPreferences extends SettingsCatalog {
  private registry = new Map<string, Entry>();
  private collections = new Map<
    string,
    { collection: SettingsCollection<any>; count: number; origin?: string; owner: string }
  >();
  private valueListeners = new Map<string, Set<() => void>>();
  /** The latest write per key, so a replaced definition never overlaps its predecessor's write. */
  private flights = new Map<
    string,
    { session: Session; context: SettingsContext; settled: boolean; done: Promise<void> }
  >();
  private definitionListeners = new Set<() => void>();
  private definitionSnapshot: readonly Setting<any>[] = [];
  private context: SettingsContext = {};
  private active = false;
  constructor(
    private storage: SettingsStorage,
    definitions: readonly Setting<any>[] = [],
  ) {
    super();
    definitions.forEach((setting) => this.define(setting));
  }

  /**
   * Registers definitions for an owning module, independently of sections. Registrations are
   * reference counted: several modules may own the same definition object, and the definition
   * stays registered until its last owner, section reference or pin is released. A different
   * definition under an existing key or collection ID is rejected. Removal never deletes
   * persisted values.
   */
  register(
    source: SettingsSource | readonly SettingsSource[],
    options: RegisterOptions,
  ): Registration {
    const list: readonly SettingsSource[] = Array.isArray(source)
      ? source
      : [source as SettingsSource];
    const settings = settingsOf(list);
    const collections = [...new Set(list.filter((item) => item instanceof SettingsCollection))];
    const ids = new Set<string>();
    for (const collection of collections) {
      if (ids.has(collection.id))
        throw new Error(
          `Duplicate settings collection "${collection.id}" in ${describe(options)}.`,
        );
      ids.add(collection.id);
      const existing = this.collections.get(collection.id);
      if (existing && existing.collection !== collection)
        throw new Error(
          `Duplicate settings collection "${collection.id}": ${describe(existing)} and ${describe(options)}.`,
        );
    }
    this.check(settings, options);
    for (const collection of collections) {
      const existing = this.collections.get(collection.id);
      if (existing) existing.count++;
      else
        this.collections.set(collection.id, {
          collection,
          count: 1,
          origin: options.origin,
          owner: options.owner,
        });
    }
    const added = settings.map((setting) => {
      const entry = this.ensure(setting);
      entry.owners.set(options.owner, (entry.owners.get(options.owner) ?? 0) + 1);
      entry.origin ??= options.origin;
      return entry;
    });
    this.definitionsChanged(added);
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        for (const collection of collections) {
          const existing = this.collections.get(collection.id);
          if (existing?.collection === collection && --existing.count === 0)
            this.collections.delete(collection.id);
        }
        for (const entry of added) {
          if (this.registry.get(entry.setting.key) !== entry) continue;
          const count = (entry.owners.get(options.owner) ?? 0) - 1;
          if (count > 0) entry.owners.set(options.owner, count);
          else entry.owners.delete(options.owner);
          if (!entry.owners.size) entry.origin = undefined;
          this.release(entry);
        }
        this.definitionsChanged();
      },
    };
  }
  /** Legacy API: sections with groups register the grouped definitions for their own lifetime. */
  add(section: SettingsSection, options?: { section: string }) {
    const items = [...new Set(section.groups.flatMap((group) => [...group.items]))];
    this.check(items);
    const registration = super.add(section, options);
    const entries = items.map((item) => {
      const entry = this.ensure(item);
      entry.references++;
      return entry;
    });
    this.definitionsChanged(entries);
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        registration.remove();
        for (const entry of entries) {
          if (this.registry.get(entry.setting.key) !== entry) continue;
          entry.references--;
          this.release(entry);
        }
        this.definitionsChanged();
      },
    };
  }
  /** Keeps a definition registered for the lifetime of this instance without claiming an owner. */
  define<T extends SettingValue>(setting: Setting<T>) {
    this.check([setting]);
    const entry = this.ensure(setting);
    entry.pinned = true;
    this.definitionsChanged([entry]);
  }
  has(setting: Setting<any>) {
    return this.registry.get(setting.key)?.setting === setting;
  }
  /** Modules that registered the definition; empty for host-pinned and section-only definitions. */
  ownersOf(setting: Setting<any> | string): readonly string[] {
    const entry = this.registry.get(typeof setting === 'string' ? setting : setting.key);
    return entry ? [...entry.owners.keys()] : [];
  }
  /** The first owning module, if any. */
  ownerOf(setting: Setting<any> | string) {
    return this.ownersOf(setting)[0];
  }
  getDefinitions = () => this.definitionSnapshot;
  subscribeDefinitions = (listener: () => void) => {
    this.definitionListeners.add(listener);
    return () => {
      this.definitionListeners.delete(listener);
    };
  };
  get<T extends SettingValue>(setting: Setting<T>): SettingState<T> {
    const entry = this.registry.get(setting.key);
    if (!entry || entry.setting !== setting)
      throw new Error(`Unregistered setting: ${setting.key}`);
    return entry.session.state;
  }
  subscribe = (setting: Setting<any>, listener: () => void) => {
    const listeners = this.valueListeners.get(setting.key) ?? new Set();
    listeners.add(listener);
    this.valueListeners.set(setting.key, listeners);
    return () => {
      listeners.delete(listener);
    };
  };
  /** Starts a context. Queued writes of the previous context resolve "cancelled"; late responses are ignored. */
  async activate(context: SettingsContext) {
    this.active = true;
    this.context = Object.freeze({ ...context });
    const entries = [...this.registry.values()];
    for (const entry of entries) this.renew(entry, this.initial(entry.setting));
    await this.loadAll(entries);
  }
  async refresh(setting: Setting<any>) {
    this.get(setting);
    const entry = this.registry.get(setting.key)!;
    if (this.active && !entry.session.state.pending) await this.load(entry, entry.session);
  }
  deactivate() {
    this.active = false;
    for (const entry of this.registry.values())
      this.renew(entry, { ...entry.session.state, pending: false });
  }
  /**
   * Validates and queues a write. At most one write per key is in flight; newer values replace
   * queued ones. Resolves "saved" once confirmed, "superseded" when a newer value replaced this one
   * before it was sent, or "cancelled" when the context changed or the definition was removed.
   * Rejects only when validation or this value's own write failed.
   */
  set<T extends SettingValue>(setting: Setting<T>, input: T): Promise<SaveResult> {
    try {
      const entry = this.writable(setting);
      return this.enqueue(entry, { kind: 'save', value: setting.parse(input) });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /** Removes the stored override (storage.reset) or, without it, saves the definition default. */
  reset(setting: Setting<any>): Promise<SaveResult> {
    try {
      return this.enqueue(this.writable(setting), { kind: 'reset' });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private writable(setting: Setting<any>) {
    const state = this.get(setting);
    if (!this.active || !state.ready || !state.writable)
      throw new Error('Setting is not writable.');
    return this.registry.get(setting.key)!;
  }
  private check(settings: readonly Setting<any>[], options?: RegisterOptions) {
    const keys = new Map<string, Setting<any>>();
    for (const setting of settings) {
      if (keys.has(setting.key) && keys.get(setting.key) !== setting)
        throw new Error(
          `Duplicate setting "${setting.key}" in ${options ? describe(options) : 'one section'}.`,
        );
      keys.set(setting.key, setting);
      const entry = this.registry.get(setting.key);
      if (entry && entry.setting !== setting)
        throw new Error(
          `Duplicate setting "${setting.key}": ${describeEntry(entry)} and ${options ? describe(options) : 'the host'} define different definitions for the same key.`,
        );
      if (!entry) setting.parse(setting.defaultValue);
    }
  }
  private ensure(setting: Setting<any>) {
    const existing = this.registry.get(setting.key);
    if (existing) return existing;
    const entry: Entry = {
      setting,
      owners: new Map(),
      pinned: false,
      references: 0,
      session: this.session(this.initial(setting)),
    };
    this.registry.set(setting.key, entry);
    return entry;
  }
  private release(entry: Entry) {
    if (entry.owners.size || entry.references || entry.pinned) return;
    this.registry.delete(entry.setting.key);
    this.cancel(entry.session);
  }
  private definitionsChanged(added: readonly Entry[] = []) {
    this.definitionSnapshot = Object.freeze(
      [...this.registry.values()].map((entry) => entry.setting),
    );
    for (const listener of this.definitionListeners) listener();
    const fresh = added.filter(
      (entry, index) =>
        added.indexOf(entry) === index &&
        !entry.session.state.ready &&
        entry.session.loadToken === 0,
    );
    if (this.active && fresh.length) void this.loadAll(fresh);
  }
  private session(state: SettingState<any>): Session {
    return { state: Object.freeze(state), loadToken: 0, flying: false, superseded: [] };
  }
  private renew(entry: Entry, state: SettingState<any>) {
    this.cancel(entry.session);
    entry.session = this.session(state);
    this.notify(entry.setting.key);
  }
  private cancel(session: Session) {
    const queued = session.queued;
    session.queued = undefined;
    queued?.waiters.forEach((waiter) => waiter.resolve('cancelled'));
    session.superseded.splice(0).forEach((waiter) => waiter.resolve('superseded'));
  }
  private current(entry: Entry, session: Session) {
    return this.registry.get(entry.setting.key) === entry && entry.session === session;
  }
  private enqueue(entry: Entry, write: Write) {
    const session = entry.session;
    return new Promise<SaveResult>((resolve, reject) => {
      if (session.queued) session.superseded.push(...session.queued.waiters);
      session.queued = { write, waiters: [{ resolve, reject }] };
      this.publishState(entry, session, { ...session.state, pending: true, error: undefined });
      if (!session.flying) void this.drain(entry, session);
    });
  }
  private async drain(entry: Entry, session: Session) {
    session.flying = true;
    const key = entry.setting.key;
    while (session.queued && this.current(entry, session)) {
      const context = this.context;
      const previous = this.flights.get(key);
      if (
        previous &&
        !previous.settled &&
        previous.session !== session &&
        previous.context === context
      ) {
        await previous.done;
        continue;
      }
      const { write, waiters } = session.queued;
      session.queued = undefined;
      session.loadToken++;
      if (session.state.error)
        this.publishState(entry, session, { ...session.state, error: undefined });
      const { writable } = session.state;
      const request: Promise<StoredSetting> =
        write.kind === 'save'
          ? attempt(() => this.storage.save(key, write.value, context)).then(() => ({
              value: write.value,
              writable,
            }))
          : this.storage.reset
            ? attempt(() => this.storage.reset!(key, context))
            : attempt(() => this.storage.save(key, entry.setting.defaultValue, context)).then(
                () => ({ value: entry.setting.defaultValue, writable }),
              );
      const flight = { session, context, settled: false, done: Promise.resolve() };
      flight.done = request.then(
        () => void (flight.settled = true),
        () => void (flight.settled = true),
      );
      this.flights.set(key, flight);
      let stored: StoredSetting | undefined;
      let failure: { error: unknown } | undefined;
      try {
        stored = await request;
      } catch (error) {
        failure = { error };
      }
      if (this.flights.get(key) === flight) this.flights.delete(key);
      if (!this.current(entry, session)) {
        waiters.forEach((waiter) =>
          failure ? waiter.reject(failure.error) : waiter.resolve('cancelled'),
        );
        break;
      }
      let value = session.state.value;
      if (!failure) {
        try {
          value = entry.setting.parse(stored!.value ?? entry.setting.defaultValue);
        } catch (error) {
          failure = { error };
        }
      }
      if (failure) {
        this.publishState(entry, session, {
          ...session.state,
          pending: !!session.queued,
          error: message(failure.error, 'Saving failed.'),
        });
        const { error } = failure;
        waiters.forEach((waiter) => waiter.reject(error));
      } else {
        this.publishState(entry, session, {
          ...session.state,
          value,
          writable: stored!.writable,
          pending: !!session.queued,
          error: undefined,
        });
        waiters.forEach((waiter) => waiter.resolve('saved'));
      }
    }
    session.flying = false;
    if (!session.queued)
      session.superseded.splice(0).forEach((waiter) => waiter.resolve('superseded'));
  }
  private initial(setting: Setting<any>): SettingState<any> {
    return {
      value: setting.defaultValue,
      ready: false,
      writable: false,
      visible: setting.visible,
      pending: false,
    };
  }
  private async loadAll(entries: readonly Entry[]) {
    if (!entries.length) return;
    const context = this.context;
    const loadMany = this.storage.loadMany;
    if (!loadMany) {
      await Promise.all(entries.map((entry) => this.load(entry, entry.session)));
      return;
    }
    const batch = attempt(() =>
      loadMany.call(
        this.storage,
        entries.map((entry) => entry.setting.key),
        context,
      ),
    );
    await Promise.all(
      entries.map((entry) =>
        this.load(
          entry,
          entry.session,
          batch.then((results) =>
            Object.hasOwn(results, entry.setting.key)
              ? results[entry.setting.key]!
              : this.storage.load(entry.setting.key, context),
          ),
        ),
      ),
    );
  }
  private async load(entry: Entry, session: Session, request?: Promise<StoredSetting>) {
    const token = ++session.loadToken;
    const fresh = () => this.current(entry, session) && session.loadToken === token;
    try {
      const result = await (request ??
        attempt(() => this.storage.load(entry.setting.key, this.context)));
      if (!fresh()) return;
      const value = entry.setting.parse(result.value ?? entry.setting.defaultValue);
      this.publishState(entry, session, {
        value,
        ready: true,
        writable: result.writable,
        visible: entry.setting.visible,
        pending: false,
      });
    } catch (error) {
      if (!fresh()) return;
      this.publishState(entry, session, {
        ...this.initial(entry.setting),
        error: message(error, 'Loading failed.'),
      });
    }
  }
  private publishState(entry: Entry, session: Session, state: SettingState<any>) {
    if (!this.current(entry, session)) return;
    session.state = Object.freeze(state);
    this.notify(entry.setting.key);
  }
  private notify(key: string) {
    for (const listener of this.valueListeners.get(key) ?? []) listener();
  }
}
/** Creates the settings owner with host-provided storage and optional host-pinned definitions. */
export function createAppPreferences(options: {
  storage: SettingsStorage;
  definitions?: readonly Setting<any>[];
}) {
  return new AppPreferences(options.storage, options.definitions);
}
