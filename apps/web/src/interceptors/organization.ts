import { defineInterceptor } from '@bitakit/core';
import { authClient } from '@/lib/auth-client';

/** Actions that name an organization run only while that organization is the active one. */
export default defineInterceptor({
  before: ({ input }) => {
    const organizationId =
      input && typeof input === 'object' && 'organizationId' in input
        ? (input as { organizationId?: unknown }).organizationId
        : undefined;
    if (!organizationId) return;
    const active = authClient.$store.atoms.session.get().data?.session.activeOrganizationId;
    if (active !== organizationId) return false;
  },
});
