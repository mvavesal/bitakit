'use client';
import { useMemo, useCallback, useContext, useSyncExternalStore, type ComponentType } from 'react';
import type { SlotMap, SlotPayload, SlotData, SlotName, LifecyclePhase } from '@bitakit/core';
import { useBitaKit } from '../providers/foundation-context.js';
import { UIContext } from '../providers/action-context.js';
import { useBitaKitReady } from '../components/plugin-slot.js';
import { buildControl, useActionList, useActions, type ActionControl } from './use-action.js';
import { useSlotPayload } from './use-slot-payload.js';

export type SlotProps<Name extends string> = { payload: SlotPayload<Name> };
export type SlotOptions<Name extends string> = { entryKey?: string } & (Name extends keyof SlotMap
  ? SlotMap[Name] extends { payload: unknown }
    ? { payload: SlotPayload<Name> }
    : { payload?: undefined }
  : { payload?: unknown });
type Common = { key: string; plugin: string; order?: number };
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
    | 'filtered';
  attached: number | null;
  selected: number;
  /** Selection is not proof of a successful React commit or visibility on screen. */
  rendered: null;
  excluded: readonly Readonly<{
    id: string;
    plugin: string;
    reason: 'key' | 'condition' | 'action-hidden' | 'action-unavailable';
  }>[];
}>;
export type SlotView<Name extends string = string> = {
  items: readonly EntryFor<Name>[];
  payload: Name extends keyof SlotMap ? SlotPayload<Name> : unknown;
  pending: boolean;
  diagnostics: SlotDiagnostics;
  /** Declared owner's phase; unavailable for legacy undeclared outlets. */
  phase?: LifecyclePhase;
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
  const actions = useActions();
  const list = useActionList();
  const ui = useContext(UIContext);
  return useMemo(() => {
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
        rendered: null,
        excluded: [] as {
          id: string;
          plugin: string;
          reason: 'key' | 'condition' | 'action-hidden' | 'action-unavailable';
        }[],
      },
    };
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
          const common = { key: item.id, plugin: item.plugin, order: item.order };
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
    view.diagnostics.selected = view.items.length;
    if (!view.error && (!snapshot || snapshot.phase === 'ready'))
      view.diagnostics.reason = view.items.length
        ? 'ready'
        : view.diagnostics.excluded.length
          ? 'filtered'
          : 'empty';
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
  ]);
}
