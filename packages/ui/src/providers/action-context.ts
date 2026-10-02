'use client';
import { createContext } from 'react';
import type { ActionList } from '@bitakit/core';
import type { ComponentType } from 'react';
import type { ControlAdapters } from '../hooks/use-action.js';

export const ActionContext = createContext<ActionList | null>(null);
export const UIContext = createContext<{
  onError: (error: unknown) => void;
  Link?: ComponentType<any>;
  pathname?: string;
  navigate?: (href: string) => void;
  /** Maps control state to the prop names of the host's component library. */
  controls?: ControlAdapters;
}>({
  onError: (error) => {
    console.error(error);
  },
});
