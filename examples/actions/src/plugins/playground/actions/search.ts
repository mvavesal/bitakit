import { defineAction } from '@bitakit/core';
import { wait } from './-wait';

// 'latest': a new run aborts the previous one's signal, so only the last query counts.
export default defineAction<string>({
  title: 'Search',
  concurrency: 'latest',
  execute: async ({ input, services, signal }) => {
    await wait(400, signal);
    services.playground.demo.search(input);
  },
});
