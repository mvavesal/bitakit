import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Title',
  value: ({ services }) => services.playground.live.selected()?.title ?? '',
  execute: ({ input, services }) => services.playground.live.update({ title: input }),
});
