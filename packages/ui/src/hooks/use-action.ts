'use client';
import { useContext, useMemo, useSyncExternalStore, type MouseEvent } from 'react';
import { useStore } from 'zustand';
import { ActionContext, UIContext } from '../providers/action-context.js';
import type {
  ActionId,
  ActionInput,
  ActionList,
  ActionResult,
  ActionSnapshot,
  ExecutionResult,
} from '@bitakit/core';
import { resolveActionId, safeHref, type ActionReference } from '@bitakit/core';

/** Props a control gets from an action: button, link, toggle, choice or menu item. */
export type ControlProps = Record<string, unknown>;
export type ControlState = Pick<
  ActionSnapshot,
  | 'id'
  | 'title'
  | 'description'
  | 'tooltip'
  | 'icon'
  | 'href'
  | 'variant'
  | 'checked'
  | 'value'
  | 'shortcut'
  | 'order'
  | 'dividerBefore'
> & {
  enabled: boolean;
  visible: boolean;
  /** Pending for this control's input (per-input actions) or for the action. */
  pending: boolean;
  disabled: boolean;
};
/** Host-level overrides for libraries that name things differently, such as `isDisabled`. */
export type ControlAdapters = {
  button?: (state: ControlState) => ControlProps;
  link?: (state: ControlState) => ControlProps;
  toggle?: (state: ControlState) => ControlProps;
  choice?: (state: ControlState) => ControlProps;
  menuItem?: (state: ControlState) => ControlProps;
};
type GetterOptions = {
  onError?: (error: unknown) => void;
  onExecuted?: (result: ExecutionResult) => void;
};

/** Everything a control needs: state, guarded execution and prop getters for common controls. */
export type ActionControl<Id extends string = string> = ControlState & {
  /** This binding's contextual input; never stored on the shared Action registration. */
  input: ActionInput<Id>;
  pendingKeys: readonly string[];
  status: ActionSnapshot['status'];
  error: unknown;
  metadata: unknown;
  internal?: boolean;
  execute(value?: ActionInput<Id>): Promise<ExecutionResult<ActionResult<Id>>>;
  /** Button: onClick, disabled, aria-busy, title. */
  props(options?: GetterOptions): ControlProps;
  /** Anchor: href, aria-disabled, client-side navigation for internal links. */
  linkProps(options?: GetterOptions & { href?: string }): ControlProps;
  /** Checkbox or switch: checked, onCheckedChange. */
  checkedProps(options?: GetterOptions): ControlProps;
  /** Select or radio group: value, onValueChange. */
  valueProps(options?: GetterOptions): ControlProps;
  /** Menu item: onSelect, disabled. */
  menuItemProps(options?: GetterOptions): ControlProps;
};

export function useActionList() {
  const list = useContext(ActionContext);
  if (!list) throw new Error('Action hooks require an ActionProvider.');
  return list;
}

/** The pending key the executor uses for an input. */
export function pendingKeyOf(
  action: Pick<ActionSnapshot, 'concurrency' | 'concurrencyKey'>,
  input: unknown,
) {
  if (!action.concurrency || action.concurrency === 'exclusive') return '*';
  if (action.concurrencyKey) return action.concurrencyKey(input);
  return typeof input === 'object' && input !== null ? JSON.stringify(input) : String(input);
}

export function buildControl<Id extends string>(
  list: ActionList,
  resolved: ActionSnapshot,
  input: unknown,
  ui: {
    onError: (error: unknown) => void;
    navigate?: (href: string) => void;
    controls?: ControlAdapters;
  },
): ActionControl<Id> {
  const pending = resolved.pendingKeys.includes(pendingKeyOf(resolved, input));
  const state: ControlState = {
    id: resolved.id,
    title: resolved.title,
    description: resolved.description,
    tooltip: resolved.tooltip,
    icon: resolved.icon,
    href: resolved.href,
    variant: resolved.variant,
    checked: resolved.checked,
    value: resolved.value,
    shortcut: resolved.shortcut,
    order: resolved.order,
    dividerBefore: resolved.dividerBefore,
    enabled: resolved.enabled,
    visible: resolved.visible,
    pending,
    disabled: !resolved.enabled || pending,
  };
  const execute = (value: unknown = input) =>
    list.execute(resolved.id, value as never) as Promise<ExecutionResult<ActionResult<Id>>>;
  const run = async (value: unknown, options?: GetterOptions) => {
    try {
      const result = await execute(value);
      options?.onExecuted?.(result);
    } catch (error) {
      (options?.onError ?? ui.onError)(error);
    }
  };
  const hint = state.tooltip ?? state.description;
  const adapt = (kind: keyof ControlAdapters, base: ControlProps) => ({
    ...base,
    ...ui.controls?.[kind]?.(state),
  });
  return {
    ...state,
    input: input as ActionInput<Id>,
    pendingKeys: resolved.pendingKeys,
    status: resolved.status,
    error: resolved.error,
    metadata: resolved.metadata,
    internal: resolved.internal,
    execute: execute as ActionControl<Id>['execute'],
    props: (options) =>
      adapt('button', {
        type: 'button',
        disabled: state.disabled,
        'aria-busy': pending || undefined,
        'aria-pressed': state.checked,
        title: hint,
        'data-pending': pending || undefined,
        onClick: () => void run(input, options),
      }),
    linkProps: (options) => {
      const href = safeHref(options?.href ?? state.href);
      const external = !!href && /^https?:/i.test(href);
      return adapt('link', {
        href: state.disabled ? undefined : href,
        title: hint,
        'aria-disabled': state.disabled || !href || undefined,
        tabIndex: state.disabled || !href ? -1 : undefined,
        onClick: (event: MouseEvent) => {
          if (state.disabled || !href) {
            event.preventDefault();
            return;
          }
          options?.onExecuted?.({ status: 'completed', value: undefined });
          if (
            external ||
            !ui.navigate ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          // A router that throws reports like a failed execution; the link stays usable.
          try {
            ui.navigate(href);
          } catch (error) {
            (options?.onError ?? ui.onError)(error);
          }
        },
      });
    },
    checkedProps: (options) =>
      adapt('toggle', {
        checked: !!state.checked,
        disabled: state.disabled,
        'aria-label': state.title,
        onCheckedChange: (value: boolean) => void run(value, options),
      }),
    valueProps: (options) =>
      adapt('choice', {
        value: state.value,
        disabled: state.disabled,
        onValueChange: (value: unknown) => void run(value, options),
      }),
    menuItemProps: (options) =>
      adapt('menuItem', {
        disabled: state.disabled,
        'aria-busy': pending || undefined,
        title: hint,
        variant: state.variant,
        onSelect: () => void run(input, options),
      }),
  };
}

/**
 * One action as a control: its resolved state for `input`, guarded `execute`, and prop getters
 * to spread on any component. Returns undefined while the action is not registered.
 */
/** Resolved controls retain their input; literal IDs and references follow strict discovery. */
export type ActionTarget<Id extends string = string> =
  | ((Id | ActionReference<Id>) & (Id extends ActionId ? unknown : never))
  | ActionControl<Id>;
export function isActionControl(value: unknown): value is ActionControl {
  return (
    !!value &&
    typeof value === 'object' &&
    'props' in value &&
    'execute' in value &&
    typeof (value as ActionControl).props === 'function'
  );
}

export function useAction<const Id extends string>(
  target: ActionTarget<Id>,
  input?: ActionInput<NoInfer<Id>>,
): ActionControl<Id> | undefined {
  const list = useActionList();
  const ui = useContext(UIContext);
  const id = isActionControl(target) ? (target.id as Id) : resolveActionId(target, list);
  const boundInput = input === undefined && isActionControl(target) ? target.input : input;
  const snapshot = useStore(list, (state) =>
    Object.hasOwn(state.actions, id) ? state.actions[id] : undefined,
  );
  return useMemo(() => {
    if (!snapshot) return undefined;
    const resolved = list.resolve(id, boundInput);
    return resolved ? buildControl<Id>(list, resolved, boundInput, ui) : undefined;
  }, [snapshot, list, id, boundInput, ui]);
}

/** Public registrations only; pass `{ internal: true }` to include helper registrations. */
export function useActions(options?: {
  internal?: boolean;
}): Readonly<Record<string, ActionSnapshot>> {
  const list = useActionList();
  const { actions } = useSyncExternalStore(list.subscribe, list.getState, list.getInitialState);
  const includeInternal = options?.internal ?? false;
  return useMemo(() => {
    if (includeInternal) return actions;
    const entries = Object.values(actions);
    if (!entries.some((action) => action.internal)) return actions;
    const visible: Record<string, ActionSnapshot> = Object.create(null);
    for (const action of entries) if (!action.internal) visible[action.id] = action;
    return visible;
  }, [actions, includeInternal]);
}
