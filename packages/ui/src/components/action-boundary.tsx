'use client';
import { useAction, type ActionId } from '@bitakit/ui/actions';
import { useContext, type ReactNode } from 'react';
import { FoundationContext } from '../providers/foundation-context.js';

/** UI gate only: server authorization is still mandatory. */
export function ActionBoundary({
  action,
  children,
  fallback,
}: {
  action: ActionId;
  children: ReactNode;
  fallback?: ReactNode | ((message: string) => ReactNode);
}) {
  const state = useAction(action);
  const foundation = useContext(FoundationContext);
  if (state && !state.visible) return null;
  if (state?.enabled) return children;
  const metadata = state?.metadata;
  const key =
    metadata && typeof metadata === 'object' && 'foundationUnavailableKey' in metadata
      ? metadata.foundationUnavailableKey
      : undefined;
  const message =
    typeof key === 'string'
      ? (foundation?.runtime.t(key) ?? key)
      : (foundation?.labels.unavailable ?? '');
  if (typeof fallback === 'function') return fallback(message);
  return fallback !== undefined ? fallback : message ? <p role="status">{message}</p> : null;
}
