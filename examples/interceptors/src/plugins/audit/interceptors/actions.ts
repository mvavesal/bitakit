import { defineInterceptor } from '@bitakit/core';

const show = (input: unknown) => (input === undefined ? '' : ` with ${JSON.stringify(input)}`);

// Every Action of the customers plugin: `customers.*` matches IDs, and `scope: 'global'` lets
// this plugin see Actions it does not own. Observers never change the result.
export default defineInterceptor({
  action: 'customers.*',
  scope: 'global',
  after: ({ id, input, services }) =>
    services.audit.log.record('action', `${id} ran${show(input)}`),
  onError: ({ id, error, services }) =>
    services.audit.log.record(
      'error',
      `${id} failed: ${error instanceof Error ? error.message : String(error)}`,
    ),
});
