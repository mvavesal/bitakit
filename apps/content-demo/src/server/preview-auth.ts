import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { apiKey } from '@better-auth/api-key';
import { multiSession, organization, twoFactor } from 'better-auth/plugins';

/** Native Better Auth configuration for the explicitly local, temporary preview. */
function createPreviewAuth() {
  return betterAuth({
    baseURL: 'http://127.0.0.1:3102',
    secret: randomBytes(32).toString('hex'),
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
      organization: [],
      member: [],
      invitation: [],
      team: [],
      teamMember: [],
      apikey: [],
      twoFactor: [],
    }),
    emailAndPassword: { enabled: true },
    plugins: [
      organization({ teams: { enabled: true } }),
      multiSession(),
      twoFactor(),
      apiKey([
        { configId: 'default', references: 'user' },
        { configId: 'organization', references: 'organization' },
      ]),
    ],
  });
}

let auth: ReturnType<typeof createPreviewAuth> | undefined;
export function previewAuth() {
  if (process.env.NODE_ENV !== 'development' || process.env.CONTENT_DEMO_AUTH !== 'memory')
    return undefined;
  return (auth ??= createPreviewAuth());
}
