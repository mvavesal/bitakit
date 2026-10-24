import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Increment',
  // Every bound control is disabled at 10; the rule lives here, not in the button.
  enabled: ({ services }) => services.counter.value.state.get().count < 10,
  execute: ({ services }) => services.counter.value.increment(),
});
