import { defineInterceptor } from '@bitakit/core';

// Every method call on the customers.list service, from an Action or from anywhere else.
export default defineInterceptor({
  service: 'customers.list',
  after: ({ service, method, args, services }) =>
    services.audit.log.record(
      'call',
      `${service}.${method}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`,
    ),
});
