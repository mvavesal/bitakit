import { defineAction } from '@bitakit/core';
import { places, type Place } from '../../services/live';

const label = (place: Place) => places.find((entry) => entry.value === place)?.label ?? place;

// A choice like the icon: the radio group shows `value` and passes the picked place.
export default defineAction<Place>({
  title: 'Place',
  value: ({ services }) => services.playground.live.state.get().place,
  execute: ({ input, services }) => services.playground.live.move(input),
  success: ({ input }) => `Look here: ${label(input)}`,
});
