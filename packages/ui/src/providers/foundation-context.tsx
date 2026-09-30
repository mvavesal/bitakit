'use client';
import { createContext, useContext } from 'react';
import type { FoundationRuntime } from '@bitakit/core';
import type { FoundationUI, FoundationLabels } from '../types/ui.js';
export const FoundationContext = createContext<{
  runtime: FoundationRuntime;
  ui: FoundationUI;
  labels: FoundationLabels;
  notify(message: string, kind: 'success' | 'failure'): unknown;
} | null>(null);
export function useFoundation() {
  const value = useContext(FoundationContext);
  if (!value) throw new Error('Foundation components require FoundationProvider.');
  return value;
}
