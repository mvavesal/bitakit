'use client';
import {
  Children,
  cloneElement,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { ActionId, ActionInput, ExecutionResult } from '@bitakit/core';
import { useAction, type ActionControl, type ActionTarget } from '../hooks/use-action.js';
import { UIContext } from '../providers/action-context.js';
import { mergeProps } from '../utils/merge-props.js';

export type ActionKind = 'button' | 'link' | 'toggle' | 'choice' | 'menuItem';
export type ActionProps<Id extends string = ActionId> = {
  /** An action ID, a typed reference, or a control from `useActionGroup` or `useSlot`. */
  id: ActionTarget<Id>;
  input?: ActionInput<NoInfer<Id>>;
  /** Defaults to `link` for actions with an href, otherwise `button`. */
  kind?: ActionKind;
  onError?: (error: unknown) => void;
  onExecuted?: (result: ExecutionResult) => void;
  /** Rendered inside the child while the action runs, after its content. */
  pending?: ReactNode;
  /** One element to bind, or a function receiving the control. */
  children: ReactElement | ((control: ActionControl<Id>) => ReactNode);
  /** Anything else (for example props a parent `asChild` slot injects) is merged into the child. */
  [prop: string]: unknown;
};

/**
 * Binds an action to any component: merges the control props into the child (handlers are
 * chained, classes joined, `disabled` combined) and fills an empty child with the action's icon
 * and title. Renders nothing while the action is hidden or not registered.
 */
export function Action<const Id extends string>({
  id,
  input,
  kind,
  onError,
  onExecuted,
  pending,
  children,
  ...injected
}: ActionProps<Id>) {
  const control = useAction(id, input);
  const { Link } = useContext(UIContext);
  if (!control || !control.visible) return null;
  if (typeof children === 'function') return <>{children(control)}</>;
  const child = Children.only(children) as ReactElement<Record<string, unknown>>;
  if (!isValidElement(child)) throw new Error('<Action> needs one element child or a function.');
  const resolved = kind ?? (control.href !== undefined ? 'link' : 'button');
  const options = { onError, onExecuted };
  const generated =
    resolved === 'link'
      ? control.linkProps(options)
      : resolved === 'toggle'
        ? control.checkedProps(options)
        : resolved === 'choice'
          ? control.valueProps(options)
          : resolved === 'menuItem'
            ? control.menuItemProps(options)
            : control.props(options);
  const Icon = control.icon;
  const content: ReactNode =
    child.props.children !== undefined ? (
      (child.props.children as ReactNode)
    ) : (
      <>
        {Icon ? <Icon aria-hidden="true" /> : null}
        {control.title}
      </>
    );
  const own = mergeProps(injected, child.props) as Record<string, unknown>;
  const element =
    resolved === 'link' &&
    child.type === 'a' &&
    Link &&
    control.href &&
    !/^https?:/i.test(control.href) &&
    !control.disabled
      ? cloneElement(
          <Link />,
          mergeProps(generated, own) as Record<string, unknown>,
          content,
          control.pending ? pending : null,
        )
      : cloneElement(
          child,
          mergeProps(generated, own) as Record<string, unknown>,
          content,
          control.pending ? pending : null,
        );
  return element;
}
