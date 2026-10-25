import { defineInterceptor } from '@bitakit/core';

// A rule over another plugin's Action: won deals stay in the pipeline.
export default defineInterceptor({
  action: 'pipeline.remove',
  // Without this, an interceptor only sees the Actions of its own plugin.
  scope: 'global',
  before: ({ input, services }) => services.pipeline.deals.find(Number(input))?.stage !== 'won',
});
