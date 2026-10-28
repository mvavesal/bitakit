import { defineSettings, setting } from '@bitakit/core';

// Saved in this browser. The interceptor reads it on every run, so switching it applies at once.
export default defineSettings(
  {
    readOnly: setting({
      default: false,
      label: 'Read-only mode',
      description: 'Adding, archiving and removing customers is blocked. Pages still open.',
    }),
  },
  { title: 'Guard' },
);
