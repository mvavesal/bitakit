import { defineAction } from '@bitakit/core';
import type { Place } from '../../services/live';

export default defineAction<Place[]>({
  title: 'Places',
  value: ({ services }) => services.playground.live.selected()?.places ?? [],
  execute: ({ input, services }) => services.playground.live.update({ places: input }),
});
