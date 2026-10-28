import { defineAction } from '@bitakit/core';
import type { Icon } from '../../services/live';

export default defineAction<Icon>({
  title: 'Icon',
  value: ({ services }) => services.playground.live.selected()?.icon,
  execute: ({ input, services }) => services.playground.live.update({ icon: input }),
});
