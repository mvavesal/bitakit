import { defineSettings, setting } from '@bitakit/core';

// Saved in this browser; Settings shows it on its own page.
export default defineSettings(
  {
    openInNewTab: setting({ default: true, label: 'Open links in a new tab' }),
  },
  { title: 'Bookmarks' },
);
