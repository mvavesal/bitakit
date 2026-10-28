import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Done',
  visible: ({ input, services }) =>
    services.tasks.list.state.get().tasks.some((task) => task.id === input && !task.done),
  concurrency: 'per-input',
  execute: ({ input, services }) => services.tasks.list.toggle(input),
});
