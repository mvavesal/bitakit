'use client';
import { useContext, type ElementType, type ComponentPropsWithoutRef } from 'react';
import { useAction } from '../hooks/use-action.js';
import { UIContext } from '../providers/action-context.js';
import { safeHref } from '@bitakit/core';
import type { ActionId } from '@bitakit/core';
export function ActionLink({
  action,
  as,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  action: ActionId;
  as?: ElementType;
  [key: string]: unknown;
}) {
  const state = useAction(action);
  const { Link } = useContext(UIContext);
  if (!state?.visible) return null;
  const href = safeHref(state.href);
  if (!state.enabled || state.pending || !href)
    return (
      <a {...props} aria-disabled="true" tabIndex={-1} onClick={(event) => event.preventDefault()}>
        {children ?? state.title}
      </a>
    );
  const Component = as ?? (!/^https?:/i.test(href) && Link ? Link : 'a');
  return (
    <Component {...props} href={href} title={props.title ?? state.tooltip ?? state.description}>
      {children ?? state.title}
    </Component>
  );
}
