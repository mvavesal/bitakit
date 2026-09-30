'use client';
import { createContext } from 'react';
import type { ActionList } from '@bitakit/core';
import type { ComponentType } from 'react';
export const ActionContext = createContext<ActionList | null>(null);
export const UIContext = createContext<{
  onError: (error: unknown) => void;
  Link?: ComponentType<any>;
  pathname?: string;
}>({
  onError: (error) => {
    console.error(error);
  },
});
