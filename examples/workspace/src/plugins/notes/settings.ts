import { defineSettings, setting } from '@bitakit/core';

export default defineSettings(
  { newestFirst: setting({ default: true, label: 'Newest notes first' }) },
  { title: 'Notes', order: 10 },
);
