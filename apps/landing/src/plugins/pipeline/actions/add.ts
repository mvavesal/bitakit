import { defineAction } from '@bitakit/core';
import PlusIcon from 'reicon-react/icons/Plus';

export default defineAction({
  title: 'New deal',
  icon: PlusIcon,
  variant: 'default',
  slots: [{ slot: 'dashboard.toolbar', order: 10 }],
  execute: ({ services }) => services.pipeline.deals.add(),
  success: 'Deal added',
});
