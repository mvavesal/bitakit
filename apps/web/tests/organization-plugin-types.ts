import { betterAuthOrganizations } from '@bitakit/better-auth/organizations';
import { authClient } from '../src/lib/auth-client';
// Check the adapter against the actual configured SDK, without making requests.
export const makeBackend = () => betterAuthOrganizations(authClient);
