'use client';
import { createContext } from 'react';
import type { ResolvedTheme, ThemePreference } from './config';
import type { setThemePreference } from './store';

type ThemeState = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  ready: boolean;
  sessionOnly: boolean;
  setPreference: typeof setThemePreference;
};
export const ThemeContext = createContext<ThemeState | null>(null);
