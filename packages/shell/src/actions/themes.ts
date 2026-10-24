import { defineAction, getService } from '@bitakit/core';
import { z } from 'zod';
import { themeSchema } from '../themes.js';
import { themeService } from '../services/themes.js';

export const selectTheme = defineAction({
  title: 'Select theme',
  input: z.object({ key: z.string() }),
  concurrency: 'exclusive',
  enabled: ({ services }) => getService(services, themeService).canWrite(),
  execute: ({ services, input }) => getService(services, themeService).select(input.key),
});
export const saveThemeCopy = defineAction({
  title: 'Save theme copy',
  input: themeSchema,
  concurrency: 'exclusive',
  enabled: ({ services }) => getService(services, themeService).canWrite(),
  execute: ({ services, input }) => getService(services, themeService).saveCopy(input),
});

export const updateTheme = defineAction({
  title: 'Save theme changes',
  input: themeSchema,
  concurrency: 'exclusive',
  enabled: ({ services }) => getService(services, themeService).canWrite(),
  execute: ({ services, input }) => getService(services, themeService).update(input),
});

export const deleteTheme = defineAction({
  title: 'Delete theme',
  input: z.object({ id: z.string() }),
  concurrency: 'exclusive',
  enabled: ({ services, input }) =>
    getService(services, themeService).canWrite() &&
    getService(services, themeService)
      .list()
      .some((theme) => theme.source === 'user' && theme.id === input?.id),
  confirm: ({ services, input }) => ({
    title: 'Delete theme?',
    description: `Delete “${
      getService(services, themeService)
        .list()
        .find((theme) => theme.source === 'user' && theme.id === input?.id)?.name ?? ''
    }”? This personal theme will be removed. If it is active, App default will be selected.`,
    destructive: true,
  }),
  execute: ({ services, input }) => getService(services, themeService).remove(input.id),
});
