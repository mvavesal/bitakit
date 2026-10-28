import { defineAction } from '@bitakit/core';

// A toggle: `checked` reads the state, the control passes the new value as input.
export default defineAction<boolean>({
  title: 'Favorite',
  checked: ({ services }) => services.playground.demo.state.get().favorite,
  execute: ({ services, input }) => services.playground.demo.setFavorite(input),
});
