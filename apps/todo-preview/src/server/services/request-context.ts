import { defineService, requestContext } from '@bitakit/core/server';
import { auth, seedPreview } from '../auth';
import { createRequestContext } from '../request-context';

/**
 * The identity of every server operation call: the verified Better Auth session and membership
 * (see ../request-context.ts). The local preview seeds its accounts first, as its auth route does.
 */
export default defineService(
  () => {
    const context = createRequestContext(auth);
    return {
      async resolve(request: Request) {
        await seedPreview();
        return context.resolve(request);
      },
    };
  },
  { provides: requestContext },
);
