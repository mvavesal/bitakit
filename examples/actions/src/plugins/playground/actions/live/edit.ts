import { defineAction } from '@bitakit/core';
import type { LiveConfig } from '../../live-action';

// Every control of the first example runs this with its change, for example
// { number: 1, title: 'Deploy' } or { number: 2, places: ['toolbar', 'navigation'] }.
export default defineAction<Partial<LiveConfig> & { number: number }>({
  title: 'Change a live Action',
  execute: ({ input, services }) => services.playground.live.set(input),
});
