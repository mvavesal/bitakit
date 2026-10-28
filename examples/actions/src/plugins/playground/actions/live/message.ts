import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Message after a run',
  value: ({ services }) => services.playground.live.selected()?.message ?? '',
  execute: ({ input, services }) => services.playground.live.update({ message: input }),
});
