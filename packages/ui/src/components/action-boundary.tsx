'use client';
import { useContext, type ReactNode } from 'react';
import { useAction, type ActionTarget } from '../hooks/use-action.js';
import { BitaKitContext } from '../providers/foundation-context.js';

/** UI gate only: server authorization is still mandatory. */
export function ActionBoundary<const Id extends string>({
  action,
  children,
  fallback,
}: {
  action: ActionTarget<Id>;
  children: ReactNode;
  fallback?: ReactNode | ((message: string) => ReactNode);
}) {
  const state = useAction(action);
  const foundation = useContext(BitaKitContext);
  if (state && !state.visible) return null;
  if (state?.enabled) return children;
  const message = foundation?.labels.unavailable ?? '';
  if (typeof fallback === 'function') return fallback(message);
  return fallback !== undefined ? fallback : message ? <p role="status">{message}</p> : null;
}
