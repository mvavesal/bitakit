import { defineAction } from '@bitakit/core';
import TrashIcon from 'reicon-react/icons/Trash';

export default defineAction({
  title: 'Remove the selected',
  icon: TrashIcon,
  enabled: ({ services }) => services.playground.live.state.get().actions.length > 1,
  execute: ({ services }) => services.playground.live.remove(),
});
