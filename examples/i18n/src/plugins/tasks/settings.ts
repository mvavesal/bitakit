import { defineSettings, setting } from '@bitakit/core';

// The texts here are the English fallbacks. Settings translates them from the catalog keys
// `tasks.settings.title` and `tasks.settings.showAdded.label` / `.description`.
export default defineSettings(
  {
    showAdded: setting({
      default: true,
      label: 'Show when a task was added',
      description: 'The time appears next to each task.',
    }),
  },
  { title: 'Tasks', category: 'general' },
);
