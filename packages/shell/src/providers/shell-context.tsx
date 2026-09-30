'use client';
import { createContext, type ReactNode } from 'react';
import type { SelectSetting } from '@bitakit/app-preferences/core';
import { ShellNotifications, type NotificationLayout } from './notifications.js';
import type { NotificationPlacement } from '../settings/notifications.js';
import { shellLayout } from '../settings/appearance.js';

export const ShellContext = createContext({
  layout: shellLayout,
  groups: ['navigation'] as readonly string[],
});

/** Definitions are available before runtime mount; preference values stay in AppPreferences. */
export function createShellProvider(
  layout: SelectSetting<'sidebar' | 'navbar'>,
  groups: readonly string[] = ['navigation'],
  notifications?: { placement?: SelectSetting<NotificationPlacement>; layout?: NotificationLayout },
) {
  const value = { layout, groups };
  return function ShellProvider({ children }: { children: ReactNode }) {
    return (
      <ShellContext.Provider value={value}>
        {children}
        {notifications && <ShellNotifications {...notifications} />}
      </ShellContext.Provider>
    );
  };
}
