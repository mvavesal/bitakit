import { defineAction } from '@bitakit/core';
import PlusIcon from 'reicon-react/icons/Plus';

export default defineAction({
  title: 'New deal',
  icon: PlusIcon,
  slots: ['dashboard.toolbar'],
  execute: ({ services }) => services.pipeline.deals.add(),
  success: 'Deal added',
});
