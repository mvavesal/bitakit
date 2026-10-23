import { defineSettings, setting, type SettingsOf } from '@bitakit/core';
import { z } from 'zod';
import { emptyHistory, historySchema } from './schemas.js';

/** Trusted, isomorphic declarations for the existing settings.storage adapter. */
export const quickSearchSettings = defineSettings(
  {
    sources: setting({ default: {}, schema: z.record(z.string(), z.boolean()), hidden: true }),
    historyEnabled: setting({
      default: true,
      label: 'Remember search history',
      description: 'Keep recent searches and opened results for your account.',
    }),
    history: setting({ default: emptyHistory, schema: historySchema, hidden: true }),
  },
  { title: 'Quick search', category: 'general' },
);

type SearchSettings = SettingsOf<typeof quickSearchSettings, 'quick-search'>;
declare module '@bitakit/core' {
  interface SettingsMap extends SearchSettings {}
}
