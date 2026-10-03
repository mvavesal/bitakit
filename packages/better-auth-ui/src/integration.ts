'use client';
import { QueryClient } from '@tanstack/react-query';
import { definePlugin, defineService } from '@bitakit/core';
import { betterAuthClient, betterAuthPlugin } from '@bitakit/better-auth';
import { createBetterAuthClient } from '@bitakit/better-auth/client';
import {
  betterAuthUIPlugin,
  type BetterAuthUIOptions,
  type BetterAuthUIConfiguration,
} from './plugin.js';
import { AuthPageLayout } from './auth-page-layout.js';
import { organizationPlugin } from './upstream/organization.js';
import { multiSessionPlugin } from './upstream/multi-session.js';
import { twoFactorPlugin } from './upstream/two-factor.js';
import { apiKeyPlugin } from './upstream/api-key.js';
import {
  betterAuthOrganizations,
  sessionOrganizationBackend,
} from '@bitakit/better-auth/organizations';
import { organizationBackend, organizationsPlugin } from '@bitakit/organizations';
import { organizationUIPlugin } from './organization-plugin.js';

type Client = ReturnType<typeof createBetterAuthClient<[]>>;
export type BetterAuthIntegrationOptions = Omit<BetterAuthUIOptions, 'provider'> & {
  client?: Client;
  provider?: Partial<Omit<BetterAuthUIConfiguration, 'authClient'>>;
  /** Composes organization services/UI with this same client; backend configuration remains explicit. */
  organizations?: Parameters<typeof organizationUIPlugin>[0];
};

/**
 * Manual composition for hosts without generated configuration: the same plugins, plus one
 * plugin that provides the client (and the organization backend) through their contracts.
 * Generated hosts provide those in `src/services/` instead and configure the options in
 * `configs/better-auth.ts` and `configs/better-auth-ui.ts`.
 */
export function createBetterAuthIntegration(options: BetterAuthIntegrationOptions = {}) {
  const { client = createBetterAuthClient(), provider = {}, organizations, ...ui } = options;
  const { redirectTo = '/', ...overrides } = provider;
  const authClient = client;
  const plugin = betterAuthUIPlugin({
    authPageLayout: AuthPageLayout,
    ...ui,
    provider: {
      queryClient: new QueryClient(),
      navigate: ({ to, replace }) => {
        if (replace) window.location.replace(to);
        else window.location.assign(to);
      },
      plugins: [
        organizationPlugin({ teams: true }),
        multiSessionPlugin(),
        twoFactorPlugin(),
        apiKeyPlugin({ organization: true }),
      ],
      ...overrides,
      // Resolve relative callbacks against the UI origin when Auth is hosted separately.
      redirectTo:
        typeof window === 'undefined'
          ? redirectTo
          : new URL(redirectTo, window.location.origin).toString(),
    },
  });
  return {
    client: authClient,
    plugins: [
      definePlugin({
        id: 'better-auth-client',
        services: [
          defineService(() => ({ client: authClient }), { provides: betterAuthClient }),
          ...(organizations
            ? [
                defineService(
                  () => sessionOrganizationBackend(authClient, betterAuthOrganizations(authClient)),
                  { provides: organizationBackend },
                ),
              ]
            : []),
        ],
      }),
      betterAuthPlugin(),
      plugin,
      ...(organizations ? [organizationsPlugin(), organizationUIPlugin(organizations)] : []),
    ],
  };
}
