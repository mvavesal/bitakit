'use client';
import { createContext, useContext } from 'react';
import type { FoundationRuntime, AuthService } from '@bitakit/core';
import type { DialogFrame, FoundationUI, FoundationLabels } from '../types/ui.js';
export type SignOutIntent = { service: AuthService; completed: boolean; fromPath: string } | null;
export const FoundationContext = createContext<{
  runtime: FoundationRuntime;
  /** A prior composition is still stopping; the replacement has not mounted. */
  transition?: 'stopping';
  /** Transient navigation ownership, never a copy of the provider's session. */
  signOutIntent?: SignOutIntent;
  setSignOutIntent?: (intent: SignOutIntent) => void;
  ui: FoundationUI;
  dialogs?: Readonly<Record<string, DialogFrame>>;
  labels: FoundationLabels;
  notify(message: string, kind: 'success' | 'failure'): unknown;
} | null>(null);
export function useFoundation() {
  const value = useContext(FoundationContext);
  if (!value) throw new Error('Foundation components require FoundationProvider.');
  return value;
}

/** Optional host access for standalone fallback surfaces; normal bindings use useFoundation. */
export function useOptionalFoundation() {
  return useContext(FoundationContext);
}
