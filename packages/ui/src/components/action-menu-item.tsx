'use client';
import { useContext, type ElementType, type ReactNode } from 'react';
import { useAction, useActionList } from '../hooks/use-action.js';
import { UIContext } from '../providers/action-context.js';
import { bindAction, type BoundAction } from '../bindings/bound-action.js';
import { ActionShortcutLabel } from './action-shortcut-label.js';
import { safeHref } from '@bitakit/core';
import type { ActionId } from '@bitakit/core';

type Props = {
  Shortcut?: ElementType;
  action?: ActionId;
  input?: unknown;
  binding?: BoundAction;
  as?: ElementType;
  Link?: ElementType;
  onError?: (error: unknown) => void;
  onExecuted?: () => void;
  children?: ReactNode;
  activation?: 'click' | 'select';
  itemProps?: Record<string, unknown>;
};
/** Shared item binding; the host only supplies its UI primitive. */
export function ActionMenuItem(props: Props) {
  return props.binding ? (
    <BoundItem {...props} binding={props.binding} />
  ) : (
    <RegisteredItem {...props} />
  );
}
function RegisteredItem(props: Props) {
  const state = useAction(props.action ?? '', props.input);
  const list = useActionList();
  if (!state) return null;
  return (
    <BoundItem
      {...props}
      binding={bindAction(list, list.resolve(state.id, props.input)!, props.input)}
    />
  );
}
function BoundItem({
  binding,
  as: Component = 'button',
  Link,
  onError,
  onExecuted,
  children,
  activation,
  itemProps,
  Shortcut,
}: Props & { binding: BoundAction }) {
  const defaults = useContext(UIContext);
  if (!binding.visible) return null;
  const Icon = binding.icon;
  const title = binding.tooltip ?? binding.description;
  const content = children ?? (
    <>
      {Icon && <Icon aria-hidden="true" />}
      {binding.title}
      {Shortcut && binding.shortcut && (
        <Shortcut>
          <ActionShortcutLabel keys={binding.shortcut.keys} />
        </Shortcut>
      )}
    </>
  );
  const href = safeHref(binding.href);
  const disabled = binding.disabled || (binding.href !== undefined && !href);
  if (binding.href !== undefined) {
    const Anchor =
      !disabled && !/^https?:/i.test(href ?? '') ? (Link ?? defaults.Link ?? 'a') : 'a';
    const link = (
      <Anchor
        {...(Component === 'button' ? { role: 'link' } : {})}
        href={disabled ? undefined : href}
        title={title}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={
          disabled ? (event: { preventDefault(): void }) => event.preventDefault() : onExecuted
        }
      >
        {content}
      </Anchor>
    );
    return Component === 'button' ? (
      link
    ) : (
      <Component {...itemProps} asChild disabled={disabled}>
        {link}
      </Component>
    );
  }
  const run = async () => {
    try {
      if ((await binding.run()).status === 'completed') onExecuted?.();
    } catch (error) {
      (onError ?? defaults.onError)(error);
    }
  };
  return (
    <Component
      {...itemProps}
      title={title}
      disabled={disabled}
      aria-busy={binding.pending || undefined}
      {...(activation === 'click' || Component === 'button'
        ? { type: 'button', onClick: () => void run() }
        : { variant: binding.variant, onSelect: () => void run() })}
    >
      {content}
    </Component>
  );
}
