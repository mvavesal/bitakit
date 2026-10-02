import { defineInterceptor } from '@bitakit/core';

/** Demo: inspect Action execution in the browser console during development. */
export default defineInterceptor({
  before: ({ id }) => {
    if (process.env.NODE_ENV !== 'production') console.debug('[Action]', id);
  },
});
