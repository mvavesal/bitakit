import type { ActionList } from '../actions/core.js';
import type { PluginScope } from '../scope.js';
import { FoundationStartupError } from '../startup-error.js';
import { createStore, type Store } from '../store.js';
import { validate } from '../schema.js';
import { contributionSource } from '../contribution-origin.js';
import {
  notifyLifecycleObserver,
  type LifecycleSnapshot,
  type LifecycleState,
} from '../lifecycle/state.js';
import type { OwnedSlotDefinition } from './define.js';
import type {
  ScopedSlots,
  SlotAttachment,
  SlotAttachmentSnapshot,
  SlotAvailability,
  SlotContent,
  SlotContribution,
  SlotItem,
  SlotReader,
  SlotSnapshot,
} from './types.js';

export class SlotError extends FoundationStartupError {
  constructor(
    readonly code:
      | 'unknown-slot'
      | 'unavailable-slot'
      | 'invalid-contribution'
      | 'conflict'
      | 'detached',
    readonly slot: string,
    plugin: string,
    message: string,
    source?: string,
    app = false,
  ) {
    super(`Slot "${slot}": ${message}`, plugin, { source, app });
  }
}
type Entry = { definition: OwnedSlotDefinition; store: Store<SlotSnapshot> };
type Attachment = {
  slot: string;
  plugin: string;
  id: string;
  key?: string;
  order: number;
  content: SlotContent & { when?: import('./types.js').SlotPredicate };
  valid: boolean;
  store: Store<SlotAttachmentSnapshot>;
  item?: SlotItem;
  dispose(): void;
  resolve(): void;
  reject(error: unknown): void;
  listeners: Set<() => void>;
};
const empty = Object.freeze([]) as readonly SlotItem[];

/** One attachment owner for the runtime. Plugin readiness is read from the existing lifecycle. */
export class SlotRuntime {
  private entries = new Map<string, Entry>();
  private attachments = new Set<Attachment>();
  private serial = 0;
  private flushing = false;
  private dirty = false;
  private actionRelease?: () => void;
  readonly reader: SlotReader;
  constructor(
    definitions: readonly OwnedSlotDefinition[],
    private lifecycle: LifecycleState,
    private actions: ActionList,
    private publish: (snapshot: SlotSnapshot) => void,
    private report: (error: unknown) => void,
    private appId = 'app',
  ) {
    for (const definition of definitions)
      this.entries.set(definition.id, {
        definition,
        store: createStore<SlotSnapshot>(
          Object.freeze({
            id: definition.id,
            plugin: definition.plugin,
            generation: 0,
            phase: 'idle',
            items: empty,
          }),
        ),
      });
    this.reader = Object.freeze({
      has: (name: string) => this.entries.has(name),
      get: (name: string) => this.entry(name).store.get(),
      subscribe: (name: string, listener: (snapshot: SlotSnapshot) => void) =>
        this.listen(this.entry(name).store, listener),
      watch: (name: string, listener: (snapshot: SlotSnapshot) => void) =>
        this.listen(this.entry(name).store, listener, true),
    });
    lifecycle.subscribe(() => this.refresh());
  }
  /** `source` names the contributing file when an unknown target comes from an attachment. */
  private entry(name: string, plugin = this.appId, source?: string) {
    const entry = this.entries.get(name);
    if (!entry)
      throw new SlotError(
        'unknown-slot',
        name,
        plugin,
        'no owning definition exists. Install and enable the plugin that declares it (in tests, pass that plugin to mountPlugin).',
        source,
        plugin === this.appId,
      );
    return entry;
  }
  /** Active contributors become dependents when their target declaration is removed. */
  contributorsTo(owners: ReadonlySet<string>): readonly string[] {
    return [
      ...new Set(
        [...this.attachments]
          .filter((attachment) => owners.has(this.entry(attachment.slot).definition.plugin))
          .map((attachment) => attachment.plugin),
      ),
    ];
  }

  /** Add/remove owned declarations only after the affected scopes have stopped. */
  replace(definitions: readonly OwnedSlotDefinition[]) {
    const names = new Set(definitions.map((definition) => definition.id));
    for (const name of this.entries.keys())
      if (!names.has(name)) {
        for (const attachment of [...this.attachments])
          if (attachment.slot === name) attachment.dispose();
        this.entries.delete(name);
      }
    for (const definition of definitions) {
      const current = this.entries.get(definition.id);
      if (current) current.definition = definition;
      else
        this.entries.set(definition.id, {
          definition,
          store: createStore<SlotSnapshot>(
            Object.freeze({
              id: definition.id,
              plugin: definition.plugin,
              generation: 0,
              phase: 'idle',
              items: empty,
            }),
          ),
        });
    }
  }
  private listen<T>(
    store: Store<T>,
    listener: (state: T) => void,
    immediate = false,
    owned?: Set<() => void>,
  ) {
    const call = (value: T) => notifyLifecycleObserver(() => listener(value), this.report);
    const unsubscribe = store.subscribe(call);
    const off = () => {
      unsubscribe();
      owned?.delete(off);
    };
    owned?.add(off);
    if (immediate) call(store.get());
    return off;
  }
  bind(scope: PluginScope, plugin: string): ScopedSlots {
    const observe = (name: string, listener: (state: SlotSnapshot) => void, immediate: boolean) => {
      const entry = this.entry(name, plugin);
      let off = () => {};
      const release = scope.onClose(() => off());
      off = this.listen(entry.store, listener);
      const dispose = () => {
        off();
        release();
      };
      if (immediate) notifyLifecycleObserver(() => listener(entry.store.get()), this.report);
      return dispose;
    };
    return Object.freeze({
      ...this.reader,
      subscribe: (name, listener) => observe(name, listener, false),
      watch: (name, listener) => observe(name, listener, true),
      attach: (contribution, options) => {
        const slot = (contribution as { slot?: unknown } | undefined)?.slot;
        if (typeof slot !== 'string')
          throw new TypeError(
            'slots.attach expects one contribution with its target: attach({ slot: "name", component | data | actionId }).',
          );
        // The same object is attached, so its recorded source still names the contributing file.
        return this.attach(
          scope,
          plugin,
          slot,
          contribution as SlotContribution,
          options?.availability ?? 'require',
        );
      },
    });
  }
  private attach(
    scope: PluginScope,
    plugin: string,
    name: string,
    contribution: SlotContribution,
    availability: SlotAvailability,
  ): SlotAttachment {
    const { definition } = this.entry(name, plugin, contributionSource(contribution));
    const source = contributionSource(contribution) ?? contributionSource(definition);
    const error = (code: SlotError['code'], message: string) =>
      new SlotError(code, name, plugin, message, source, plugin === this.appId);
    if (availability !== 'require' && availability !== 'wait')
      throw error('invalid-contribution', 'availability must be require or wait.');
    if (
      availability === 'require' &&
      this.phase(definition.plugin, this.lifecycle.get()) !== 'ready'
    )
      throw error(
        'unavailable-slot',
        `owner "${definition.plugin}" is not ready; use availability: 'wait' to attach later.`,
      );
    const kind = definition.accepts === 'actions' ? 'actionId' : definition.accepts;
    if (
      !Object.hasOwn(contribution, kind) ||
      ['component', 'data', 'actionId'].some(
        (key) => key !== kind && Object.hasOwn(contribution, key),
      )
    )
      throw error('invalid-contribution', `the contract accepts ${definition.accepts}.`);
    if (
      kind === 'actionId' &&
      (!this.actions.get(contribution.actionId!) ||
        this.actions.get(contribution.actionId!)?.internal)
    )
      throw error('invalid-contribution', 'actionId must reference an existing public Action.');
    if (
      definition.policy === 'keyed' &&
      (typeof contribution.key !== 'string' || !contribution.key)
    )
      throw error('invalid-contribution', 'a keyed slot requires a non-empty key.');
    const id = `${plugin}:${contribution.id ?? ++this.serial}`;
    for (const current of this.attachments)
      if (
        current.slot === name &&
        (current.id === id ||
          definition.policy === 'single' ||
          (definition.policy === 'keyed' && current.key === contribution.key))
      )
        throw error(
          'conflict',
          `contribution "${id}" conflicts with "${current.id}"; remove it explicitly first.`,
        );
    let resolve!: () => void, reject!: (error: unknown) => void;
    const ready = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    void ready.catch(() => {});
    const record: Attachment = {
      slot: name,
      plugin,
      id,
      key: contribution.key,
      order: contribution.order ?? 0,
      content: {
        ...(kind === 'actionId'
          ? { actionId: contribution.actionId!, input: contribution.input }
          : kind === 'component'
            ? { component: contribution.component! }
            : { data: contribution.data }),
        when: contribution.when,
      },
      valid: kind !== 'data',
      listeners: new Set(),
      resolve,
      reject,
      store: createStore<SlotAttachmentSnapshot>(
        Object.freeze({
          id,
          slot: name,
          plugin,
          generation: this.lifecycle.get().generation,
          phase: 'pending',
        }),
      ),
      dispose: () => {},
    };
    // Register cleanup before exposing any event: a callback may stop its own scope.
    const release = scope.onClose(() => record.dispose());
    record.dispose = () => {
      if (!this.attachments.delete(record)) return;
      release();
      record.store.set(
        Object.freeze({ ...record.store.get(), phase: 'detached', reason: undefined }),
      );
      for (const off of record.listeners) off();
      reject(error('detached', 'contributor detached before attachment completed.'));
      this.refresh();
    };
    this.attachments.add(record);
    if (!this.actionRelease) this.actionRelease = this.actions.subscribe(() => this.refresh());
    this.refresh();
    if (kind === 'data') {
      void validate(definition.schema!, contribution.data).then(
        (data) => {
          if (!this.attachments.has(record)) return;
          record.content = { data };
          record.valid = true;
          this.refresh();
        },
        (cause) => {
          if (!this.attachments.delete(record)) return;
          release();
          const failure = error(
            'invalid-contribution',
            cause instanceof Error ? cause.message : String(cause),
          );
          record.store.set(
            Object.freeze({
              ...record.store.get(),
              phase: 'failed',
              reason: undefined,
              failure: Object.freeze({ message: failure.message, plugin, source }),
            }),
          );
          for (const off of record.listeners) off();
          reject(failure);
          this.refresh();
        },
      );
    }
    return Object.freeze({
      get: record.store.get,
      subscribe: (listener) =>
        this.attachments.has(record)
          ? this.listen(record.store, listener, false, record.listeners)
          : () => {},
      watch: (listener) => {
        if (this.attachments.has(record))
          return this.listen(record.store, listener, true, record.listeners);
        notifyLifecycleObserver(() => listener(record.store.get()), this.report);
        return () => {};
      },
      ready,
      dispose: record.dispose,
    });
  }
  private phase(plugin: string, state: LifecycleSnapshot) {
    const owner = state.plugins.find((entry) => entry.id === plugin);
    if (!owner) return 'blocked';
    if (state.cleanup === 'pending') return 'stopping';
    return owner.phase;
  }
  private refresh() {
    this.dirty = true;
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.dirty) {
        this.dirty = false;
        const state = this.lifecycle.get();
        for (const record of [...this.attachments]) {
          if (!this.attachments.has(record)) continue;
          const owner = this.entries.get(record.slot)!.definition.plugin;
          const reason = !record.valid
            ? 'validating'
            : this.phase(owner, state) !== 'ready'
              ? 'owner-unavailable'
              : this.phase(record.plugin, state) !== 'ready'
                ? 'contributor-unavailable'
                : 'actionId' in record.content &&
                    (!this.actions.get(record.content.actionId!) ||
                      this.actions.get(record.content.actionId!)?.internal)
                  ? 'action-unavailable'
                  : undefined;
          const phase = reason ? 'pending' : 'attached';
          const previous = record.store.get();
          if (
            previous.phase !== phase ||
            previous.reason !== reason ||
            previous.generation !== state.generation
          ) {
            record.item =
              phase === 'attached'
                ? Object.freeze({
                    ...record.content,
                    id: record.id,
                    plugin: record.plugin,
                    key: record.key,
                    order: record.order,
                    generation: state.generation,
                  })
                : undefined;
            record.store.set(
              Object.freeze({ ...previous, phase, reason, generation: state.generation }),
            );
          }
          // An observer may change readiness or close a scope. Do not resolve or advance
          // another attachment using the lifecycle snapshot captured before that callback.
          if (this.dirty) break;
          if (phase === 'attached' && this.attachments.has(record)) record.resolve();
        }
        // Use the current lifecycle after reentrant observers; the next pass completes updates.
        if (this.dirty) continue;
        for (const [name, entry] of this.entries) {
          const phase = this.phase(entry.definition.plugin, state);
          const failure = state.plugins.find(
            (plugin) => plugin.id === entry.definition.plugin,
          )?.failure;
          const items = [...this.attachments]
            .filter((record) => record.slot === name && record.item)
            .map((record) => record.item!)
            .sort((a, b) => a.order - b.order);
          const previous = entry.store.get();
          if (
            previous.phase === phase &&
            previous.generation === state.generation &&
            previous.failure === failure &&
            previous.items.length === items.length &&
            previous.items.every((item, index) => item === items[index])
          )
            continue;
          const next = Object.freeze({
            ...previous,
            phase,
            failure,
            generation: state.generation,
            items: items.length ? Object.freeze(items) : empty,
          });
          entry.store.set(next);
          if (!this.dirty && entry.store.get() === next)
            notifyLifecycleObserver(() => this.publish(next), this.report);
          if (this.dirty) break;
        }
      }
    } finally {
      this.flushing = false;
    }
    if (!this.attachments.size) {
      this.actionRelease?.();
      this.actionRelease = undefined;
    }
  }
}

declare module '../events/types.js' {
  interface EventMap {
    'runtime.slot': SlotSnapshot;
  }
}
