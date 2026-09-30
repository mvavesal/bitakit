import type { ActionInterceptor } from '@bitakit/ui/actions';

/** Demo: inspect Action execution in the browser console during development. */
export default {
  before({ id }) {
    if (process.env.NODE_ENV !== 'production') console.debug('[Action]', id);
  },
} satisfies ActionInterceptor;
