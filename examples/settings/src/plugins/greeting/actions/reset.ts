import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Reset greeting settings',
  // Actions read and write settings directly; every bound control and page updates.
  execute: async ({ settings }) => {
    await Promise.all([
      settings.greeting.name.reset(),
      settings.greeting.formal.reset(),
      settings.greeting.language.reset(),
      settings.greeting.size.reset(),
    ]);
  },
  success: 'Greeting settings reset',
});
