import { defineAction } from '@bitakit/core';
import TrashIcon from 'reicon-react/icons/Trash';

export default defineAction<number>({
  title: 'Remove',
  icon: TrashIcon,
  execute: ({ input, services }) => services.playground.live.remove(input),
});
