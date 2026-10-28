import { defineAction } from '@bitakit/core';

// The editor's controls are Actions too, each a few lines: `value` (or `checked`) shows the
// selected Action's field, and running it with the control's new value changes that field.
export default defineAction<string>({
  title: 'Edit',
  value: ({ services }) => String(services.playground.live.state.get().selected),
  execute: ({ input, services }) => services.playground.live.select(Number(input)),
});
