import { defineInterceptor } from '@bitakit/core';

// Observes every change to the pipeline service, from Actions, pages or other services.
export default defineInterceptor({
  service: 'pipeline.deals',
  after: ({ method, args }) => {
    if (method !== 'find') console.info('[guard] pipeline.deals', method, args);
  },
});
