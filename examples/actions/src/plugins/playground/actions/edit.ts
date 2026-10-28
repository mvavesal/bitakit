import { defineAction } from '@bitakit/core';
import type { Live } from '../services/live';

// The one editor Action: every control in example 1 runs it with its change, for example
// { title: 'Deploy' } or { place: 'navigation' }.
export default defineAction<Partial<Live>>({
  title: 'Change the live Action',
  execute: ({ input, services }) => services.playground.live.set(input),
});
