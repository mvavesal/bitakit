import { defineAction } from '@bitakit/core';
import PlusIcon from 'reicon-react/icons/Plus';
import { capacity } from '../../services/live';

export default defineAction({
  title: 'Add action',
  icon: PlusIcon,
  enabled: ({ services }) => services.playground.live.state.get().configs.length < capacity,
  execute: ({ services }) => services.playground.live.add(),
});
