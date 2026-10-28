import { defineAction } from '@bitakit/core';

// A button beside the dashboard's title, placed from this plugin.
export default defineAction({
  title: 'Record a sample order',
  slots: ['dashboard.toolbar'],
  execute: ({ services }) => services.orders.recent.record(),
  success: 'Order recorded',
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not record an order.'),
});
