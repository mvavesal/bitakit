import { defineInterceptor } from '@bitakit/core';

// Observes every call to notes.list, from Actions, pages or other services, in the console.
export default defineInterceptor({
  service: 'notes.list',
  after: ({ method, args }) => console.info('[guard] notes.list', method, args),
});
