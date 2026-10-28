import { defineAction } from '@bitakit/core';
import { wait } from './-wait';

// Returns a promise: bound buttons show pending and a second click is skipped ('exclusive').
export default defineAction({
  title: 'Save slowly',
  execute: ({ signal }) => wait(2000, signal),
  success: 'Saved after 2 seconds',
});
