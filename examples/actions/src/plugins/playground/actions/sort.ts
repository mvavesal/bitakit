import { defineAction } from '@bitakit/core';

// A choice: `value` reads the selection, the control passes the chosen value as input.
export default defineAction<'newest' | 'name'>({
  title: 'Sort by',
  value: ({ services }) => services.playground.demo.state.get().sort,
  execute: ({ services, input }) => services.playground.demo.setSort(input),
});
