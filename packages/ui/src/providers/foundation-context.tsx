'use client';
import { createContext, useContext } from 'react';
import type { BitaKitRuntime, AuthService } from '@bitakit/core';
import type { DialogFrame, BitaKitUI, BitaKitLabels } from '../types/ui.js';
export type SignOutIntent = { service: AuthService; completed: boolean; fromPath: string } | null;
export const BitaKitContext = createContext<{
  runtime: BitaKitRuntime;
  /** A prior composition is still stopping; the replacement has not mounted. */
  transition?: 'stopping';
  /** Transient navigation ownership, never a copy of the provider's session. */
  signOutIntent?: SignOutIntent;
  setSignOutIntent?: (intent: SignOutIntent) => void;
  ui: BitaKitUI;
  dialogs?: Readonly<Record<string, DialogFrame>>;
  labels: BitaKitLabels;
  notify(message: string, kind: 'success' | 'failure'): unknown;
} | null>(null);
export function useBitaKit() {
  const value = useContext(BitaKitContext);
  if (!value) throw new Error('Foundation components require BitaKitRuntimeProvider.');
  return value;
}

/** Optional host access for standalone fallback surfaces; normal bindings use useBitaKit. */
export function useOptionalBitaKit() {
  return useContext(BitaKitContext);
}
