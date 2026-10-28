import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear completed',
  enabled: ({ services }) => services.tasks.list.state.get().tasks.some((task) => task.done),
  execute: ({ services }) => services.tasks.list.clearDone(),
  success: 'Completed tasks cleared',
});
