import { defineSettings, setting } from '@bitakit/core';

// Which products count as low on stock; Settings → Inventory shows the field.
export default defineSettings(
  {
    lowStock: setting({
      default: 10,
      control: 'number',
      label: 'Low stock below',
      description: 'Products with fewer items than this show on the dashboard.',
    }),
  },
  { title: 'Inventory' },
);
