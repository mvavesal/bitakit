'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { ResolvedTheme, ThemePreference } from '@/lib/theme/config';
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setThemePreference,
  subscribeTheme,
} from '@/lib/theme/store';

import { ThemeContext } from '@/lib/theme/context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const value = useMemo(() => {
    const [preference = 'system', resolved = 'light', persistence] = (
      snapshot === 'pending' ? '' : snapshot
    ).split(':');
    return {
      preference: (preference || 'system') as ThemePreference,
      resolved: resolved as ResolvedTheme,
      ready: snapshot !== 'pending',
      sessionOnly: persistence === 'session',
      setPreference: setThemePreference,
    };
  }, [snapshot]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
