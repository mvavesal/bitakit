import { defineAction } from '@bitakit/core';

// Writes settings from an Action: the same values the settings page edits, saved through the
// app's settings storage (here: the server).
export default defineAction({
  title: 'Pause notifications',
  enabled: ({ settings }) => settings.profile.channels.get().length > 0,
  execute: async ({ settings }) => {
    await settings.profile.channels.set([]);
    await settings.profile.digest.set('never');
  },
  success: 'Notifications paused',
});
