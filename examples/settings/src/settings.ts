import { defineSettings, setting } from '@bitakit/core';

// App-wide settings keep plain keys: `useSetting('companyName')`, `settings.companyName`.
export default defineSettings(
  {
    companyName: setting({ default: 'Acme', label: 'Company name' }),
  },
  { title: 'Company', order: 0 },
);
