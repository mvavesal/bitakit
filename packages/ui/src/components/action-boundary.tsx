'use client';
import { useContext, type ReactNode } from 'react';
import type { ActionId, ActionReference } from '@bitakit/core';
import { useAction } from '../hooks/use-action.js';
import { FoundationContext } from '../providers/foundation-context.js';

/** UI gate only: server authorization is still mandatory. */
export function ActionBoundary<Id extends ActionId>({
  action,
  children,
  fallback,
}: {
  action: Id | ActionReference<Id>;
  children: ReactNode;
  fallback?: ReactNode | ((message: string) => ReactNode);
}) {
  const state = useAction(action);
  const foundation = useContext(FoundationContext);
  if (state && !state.visible) return null;
  if (state?.enabled) return children;
  const message = foundation?.labels.unavailable ?? '';
  if (typeof fallback === 'function') return fallback(message);
  return fallback !== undefined ? fallback : message ? <p role="status">{message}</p> : null;
}
