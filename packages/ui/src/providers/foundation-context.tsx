'use client';
import { createContext, useContext } from 'react';
import type { FoundationRuntime, AuthService } from '@bitakit/core';
import type { FoundationUI, FoundationLabels } from '../types/ui.js';
export type SignOutIntent = { service: AuthService; completed: boolean; fromPath: string } | null;
export const FoundationContext = createContext<{
  runtime: FoundationRuntime;
  /** Transient navigation ownership, never a copy of the provider's session. */
  signOutIntent?: SignOutIntent;
  setSignOutIntent?: (intent: SignOutIntent) => void;
  ui: FoundationUI;
  labels: FoundationLabels;
  notify(message: string, kind: 'success' | 'failure'): unknown;
} | null>(null);
export function useFoundation() {
  const value = useContext(FoundationContext);
  if (!value) throw new Error('Foundation components require FoundationProvider.');
  return value;
}
