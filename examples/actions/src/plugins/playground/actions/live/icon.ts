import { defineAction } from '@bitakit/core';
import type { Icon } from '../../services/live';

// A choice: the radio group shows `value` and passes the picked icon as input.
export default defineAction<Icon>({
  title: 'Icon',
  value: ({ services }) => services.playground.live.state.get().icon,
  execute: ({ input, services }) => services.playground.live.set({ icon: input }),
});
