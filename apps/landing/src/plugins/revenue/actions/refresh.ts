import { defineAction } from '@bitakit/core';
import RefreshIcon from 'reicon-react/icons/Refresh';

export default defineAction({
  title: 'Refresh revenue',
  icon: RefreshIcon,
  // Placed in the dashboard's toolbar; the dashboard never imports this plugin.
  slots: ['dashboard.toolbar'],
  // One refresh at a time: every bound control shows the same pending state.
  concurrency: 'exclusive',
  execute: ({ services }) => services.revenue.data.refresh(),
  success: 'Revenue updated',
});
