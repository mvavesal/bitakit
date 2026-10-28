import { defineAction } from '@bitakit/core';
import PlusIcon from 'reicon-react/icons/Plus';
import { capacity } from '../../services/live';

// `icon` is any icon component; a bound button shows it before the title.
export default defineAction({
  title: 'Add action',
  icon: PlusIcon,
  enabled: ({ services }) => services.playground.live.state.get().actions.length < capacity,
  execute: ({ services }) => services.playground.live.add(),
});
