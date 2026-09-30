'use client';
import { notify } from '@/lib/notifications';
import { startTransition } from 'react';
import type { SettingsStorage } from '@bitakit/app-preferences/core';
import { readSetting, saveSetting } from './server/actions';
import { THEME_STORAGE_KEY, parseThemePreference } from '@/lib/theme/config';

export const settingsStorage: SettingsStorage = {
  async load(key, context) {
    const result = await readSetting(key, context.organizationId, context.userId);
    if (!context.userId && key === 'appearance.theme') {
      try {
        const local = localStorage.getItem(THEME_STORAGE_KEY);
        if (local !== null) return { ...result, value: parseThemePreference(local) };
      } catch {
        /* Use the server-resolved default when browser storage is unavailable. */
      }
    }
    return result;
  },
  async save(key, value, context) {
    // Theme application updates the browser cache after this confirmed write.
    await new Promise<void>((resolve, reject) =>
      startTransition(async () => {
        try {
          await saveSetting(key, value, context.organizationId, context.userId);
          notify.success('saved', `setting:${key}`);
          resolve();
        } catch (error) {
          notify.error('saveFailed', `setting:${key}`);
          reject(error);
        }
      }),
    );
  },
};
