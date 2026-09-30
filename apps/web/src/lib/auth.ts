import 'server-only';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { zenstackAdapter } from '@zenstackhq/better-auth';
import { getDatabase } from './db';
import { organizationAccessHooks } from './auth/organization-access';
import { createAuthOptions } from './auth/options';
import { getAuthMail } from './auth/mail';

function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) {
    throw new Error('Authentication is not configured.');
  }
  const authOptions = createAuthOptions(process.env.SMTP_HOST ? getAuthMail() : undefined);
  return betterAuth({
    ...authOptions,
    socialProviders: {
      ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },
    hooks: organizationAccessHooks,
    appName: 'SaaS Foundation',
    trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: zenstackAdapter(getDatabase(), { provider: 'postgresql' }),
    plugins: [...authOptions.plugins, nextCookies()],
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (auth ??= createAuth());
}
