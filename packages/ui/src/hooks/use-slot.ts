'use client';
import {
  useEffect,
  useMemo,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  candidateNames,
  selectSingle,
  type SlotMap,
  type SlotPayload,
  type SlotData,
  type SlotName,
  type SlotPolicy,
  type LifecyclePhase,
} from '@bitakit/core';
import { useBitaKit } from '../providers/foundation-context.js';
import { UIContext } from '../providers/action-context.js';
import { useBitaKitReady } from '../components/plugin-slot.js';
import { buildControl, useActionList, type ActionControl } from './use-action.js';
import { useSlotPayload } from './use-slot-payload.js';

/** Props of a contributed component; `children` is what the outlet wraps, such as a page in a layout. */
export type SlotProps<Name extends string> = { payload: SlotPayload<Name>; children?: ReactNode };
export type SlotOptions<Name extends string> = { entryKey?: string } & (Name extends keyof SlotMap
  ? SlotMap[Name] extends { payload: unknown }
    ? { payload: SlotPayload<Name> }
    : { payload?: undefined }
  : { payload?: unknown });
/** `key` identifies the entry for React; `entryKey` is the contribution's own key (a variant). */
type Common = { key: string; plugin: string; order?: number; entryKey?: string };
export type SlotComponentEntry = Common & { kind: 'component'; component: ComponentType<any> };
export type SlotActionEntry = Common & {
  kind: 'action';
  actionId: string;
  input: unknown;
  action: ActionControl;
};
export type SlotDataEntry<Data = unknown> = Common & { kind: 'data'; data: Data };
export type SlotEntry = SlotComponentEntry | SlotActionEntry | SlotDataEntry;
type EntryFor<Name extends string> = Name extends keyof SlotMap
  ? SlotMap[Name] extends { accepts: 'actions' }
    ? SlotActionEntry
    : SlotMap[Name] extends { accepts: 'component' }
      ? SlotComponentEntry
      : SlotMap[Name] extends { accepts: 'data' }
        ? SlotDataEntry<SlotData<Name>>
        : SlotEntry
  : SlotEntry;
export type SlotDiagnostics = Readonly<{
  slot: string;
  owner: string | null;
  reason:
    | 'ready'
    | 'empty'
    | 'initializing'
    | 'update-pending'
    | 'owner-unavailable'
    | 'validating-payload'
    | 'invalid-payload'
    | 'binding-error'
    | 'filtered'
    /** A single slot with several candidates and no decision renders the owner's fallback. */
    | 'ambiguous'
    /** The app's `choose` entry names no available candidate. */
    | 'choice-unavailable';
  attached: number | null;
  selected: number;
  /** Single slots: every eligible candidate as `<plugin>` or `<plugin>:<key>`, the names `choose` accepts. */
  candidates?: readonly string[];
  /** Selection is not proof of a successful React commit or visibility on screen. */
  rendered: null;
  excluded: readonly Readonly<{
    id: string;
    plugin: string;
    reason: 'key' | 'condition' | 'action-hidden' | 'action-unavailable' | 'not-selected';
  }>[];
}>;
export type SlotView<Name extends string = string> = {
  items: readonly EntryFor<Name>[];
  payload: Name extends keyof SlotMap ? SlotPayload<Name> : unknown;
  pending: boolean;
  diagnostics: SlotDiagnostics;
  /** Declared owner's phase; unavailable for legacy undeclared outlets. */
  phase?: LifecyclePhase;
  /** The declared policy; `single` views hold at most the selected candidate. */
  policy?: SlotPolicy;
  error?: Error;
};
/** One outlet's validated context and live contributions. Unmount never detaches shared entries. */
export function useSlot<const Name extends SlotName>(
  name: Name,
  ...[options]: SlotOptions<Name> extends { payload: unknown }
    ? [options: SlotOptions<Name>]
    : [options?: SlotOptions<Name>]
): SlotView<Name> {
  const { runtime } = useBitaKit();
  const ready = useBitaKitReady();
  const lifecycle = useSyncExternalStore(
    runtime.lifecycle.subscribe,
    runtime.lifecycle.get,
    runtime.lifecycle.get,
  );
  const declared = runtime.slots.has(name);
  const definition = useMemo(
    () => runtime.modules.flatMap((module) => module.slots).find((slot) => slot.id === name),
    [runtime, runtime.modules, name],
  );
  const read = useCallback(
    () => (declared ? runtime.slots.get(name) : undefined),
    [runtime, name, declared],
  );
  const subscribe = useCallback(
    (listener: () => void) => (declared ? runtime.slots.subscribe(name, listener) : () => {}),
    [runtime, name, declared],
  );
  const snapshot = useSyncExternalStore(subscribe, read, read);
  const context = useSlotPayload(definition?.payload, options?.payload);
  const list = useActionList();
  // Only the snapshots of the Actions this outlet's entries reference. A component or data slot
  // never rebuilds its view because an Action changed, and an action slot only when one of its
  // own Actions did (a run elsewhere, or another Action's refresh, leaves it alone).
  const actionIds = useMemo(
    () =>
      (snapshot?.items ?? []).flatMap((item) =>
        'actionId' in item && item.actionId ? [item.actionId] : [],
      ),
    [snapshot],
  );
  const actions = useStore(
    list,
    useShallow((state) =>
      actionIds.map((id) => (Object.hasOwn(state.actions, id) ? state.actions[id] : undefined)),
    ),
  );
  const ui = useContext(UIContext);
  const result = useMemo(() => {
    const view = {
      items: [] as SlotEntry[],
      payload: context.value,
      pending:
        !ready ||
        context.pending ||
        (!!snapshot &&
          (['idle', 'starting', 'stopping'].includes(snapshot.phase) ||
            (snapshot.phase === 'stopped' && lifecycle.phase === 'starting'))),
      phase: snapshot?.phase,
      policy: definition?.policy,
      error: context.error,
      diagnostics: {
        slot: name,
        owner: snapshot?.plugin ?? null,
        reason: (context.error
          ? 'invalid-payload'
          : context.pending
            ? 'validating-payload'
            : !ready
              ? 'initializing'
              : snapshot && snapshot.phase !== 'ready'
                ? lifecycle.operation?.kind === 'update'
                  ? 'update-pending'
                  : 'owner-unavailable'
                : 'empty') as SlotDiagnostics['reason'],
        attached: snapshot?.items.length ?? null,
        selected: 0,
        candidates: undefined as readonly string[] | undefined,
        rendered: null,
        excluded: [] as {
          id: string;
          plugin: string;
          reason: 'key' | 'condition' | 'action-hidden' | 'action-unavailable' | 'not-selected';
        }[],
      },
    };
    const appId = runtime.config.appId ?? 'app';
    if (view.pending && !view.error && !context.pending && definition?.policy === 'single') {
      // File contributions are known before startup. Render the selected one at once, so the
      // owner's default does not flash and a layout does not remount its page when the runtime
      // becomes ready; the key equals the attachment ID the runtime gives the same view. A
      // payload must be validated first: a contribution never receives an unchecked payload.
      const selection = selectSingle(
        runtime.modules.flatMap((plugin) =>
          plugin.views.flatMap((item, index) =>
            item.slot === name
              ? [
                  {
                    plugin: plugin.id,
                    key: item.key,
                    item,
                    id: `${plugin.id}:${item.id ?? `view:${index}`}`,
                  },
                ]
              : [],
          ),
        ),
        { choice: runtime.config.choose?.[name], appId },
      );
      const selected = selection.selected;
      if (selected)
        view.items = [
          {
            key: selected.id,
            plugin: selected.plugin,
            order: selected.item.order,
            entryKey: selected.key,
            kind: 'component',
            component: selected.item.component as ComponentType<any>,
          },
        ];
    }
    if (view.pending || view.error) return view as unknown as SlotView<Name>;
    try {
      if (snapshot) {
        for (const item of snapshot.items) {
          if (options?.entryKey !== undefined && item.key !== options.entryKey) {
            view.diagnostics.excluded.push({ id: item.id, plugin: item.plugin, reason: 'key' });
            continue;
          }
          if (item.when && !item.when({ payload: context.value })) {
            view.diagnostics.excluded.push({
              id: item.id,
              plugin: item.plugin,
              reason: 'condition',
            });
            continue;
          }
          const common = {
            key: item.id,
            plugin: item.plugin,
            order: item.order,
            entryKey: item.key,
          };
          if ('actionId' in item) {
            const input = item.input ? item.input({ payload: context.value }) : undefined;
            const action = list.resolve(item.actionId!, input);
            if (action?.visible && !action.internal)
              view.items.push({
                ...common,
                kind: 'action',
                actionId: action.id,
                input,
                action: buildControl(list, action, input, ui),
              });
            else
              view.diagnostics.excluded.push({
                id: item.id,
                plugin: item.plugin,
                reason: action ? 'action-hidden' : 'action-unavailable',
              });
          } else if ('component' in item)
            view.items.push({
              ...common,
              kind: 'component',
              component: item.component as ComponentType<any>,
            });
          else view.items.push({ ...common, kind: 'data', data: item.data });
        }
      } else {
        // Legacy views remain readable until their owner adopts declarations.
        view.items = runtime.modules
          .flatMap((plugin) =>
            plugin.views.flatMap((item, index) =>
              item.slot === name &&
              runtime.isReady(plugin.id) &&
              (options?.entryKey === undefined || item.key === options.entryKey) &&
              (!item.when || item.when({ payload: context.value }))
                ? [
                    {
                      key: `${plugin.id}:${index}`,
                      plugin: plugin.id,
                      order: item.order,
                      kind: 'component' as const,
                      component: item.component as ComponentType<any>,
                    },
                  ]
                : [],
            ),
          )
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
    } catch (cause) {
      view.items = [];
      view.diagnostics.reason = 'binding-error';
      view.error = new Error(
        `Slot "${name}" could not bind its outlet: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }
    let unresolved: SlotDiagnostics['reason'] | undefined;
    if (!view.error && definition?.policy === 'single') {
      const selection = selectSingle(
        view.items.map((entry) => ({ entry, plugin: entry.plugin, key: entry.entryKey })),
        { choice: runtime.config.choose?.[name], appId },
      );
      unresolved = selection.reason;
      view.diagnostics.candidates = selection.candidates.map(
        (candidate) => candidateNames(candidate)[1] ?? candidate.plugin,
      );
      view.items = selection.selected ? [selection.selected.entry] : [];
      for (const candidate of selection.candidates)
        if (candidate !== selection.selected)
          view.diagnostics.excluded.push({
            id: candidate.entry.key,
            plugin: candidate.plugin,
            reason: 'not-selected',
          });
    }
    view.diagnostics.selected = view.items.length;
    if (!view.error && (!snapshot || snapshot.phase === 'ready'))
      view.diagnostics.reason = view.items.length
        ? 'ready'
        : (unresolved ?? (view.diagnostics.excluded.length ? 'filtered' : 'empty'));
    return view as unknown as SlotView<Name>;
  }, [
    ready,
    context.value,
    context.pending,
    context.error,
    snapshot,
    lifecycle,
    runtime,
    name,
    actions,
    options?.entryKey,
    list,
    ui,
    definition,
  ]);
  const unresolved =
    result.diagnostics.reason === 'ambiguous' || result.diagnostics.reason === 'choice-unavailable';
  useEffect(() => {
    if (unresolved) reportUnresolved(name, result.diagnostics, runtime.config.choose?.[name]);
  }, [unresolved, name, result.diagnostics, runtime]);
  return result;
}

const reported = new Set<string>();
/** Logs an unresolved single slot once per slot, naming the candidates and both fixes. */
function reportUnresolved(name: string, diagnostics: SlotDiagnostics, choice?: string) {
  const candidates = diagnostics.candidates ?? [];
  const message =
    diagnostics.reason === 'choice-unavailable'
      ? `[bitakit] Slot "${name}": choose names "${choice}", but no available candidate matches it; the owner's default renders.`
      : `[bitakit] Slot "${name}" has several candidates (${candidates.join(', ')}) and renders the owner's default. Choose one in bitakit.config.ts (choose: { '${name}': '<plugin>' or '<plugin>:<key>' }), or contribute it from the app itself.`;
  if (reported.has(message)) return;
  reported.add(message);
  console.error(message);
}
