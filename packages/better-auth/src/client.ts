'use client';
import { createAuthClient, type ReactAuthClient } from 'better-auth/react';
import {
  organizationClient,
  multiSessionClient,
  twoFactorClient,
} from 'better-auth/client/plugins';
import { apiKeyClient } from '@better-auth/api-key/client';
import type { BetterAuthClientOptions, BetterAuthClientPlugin } from 'better-auth/client';

const standardPlugins = () =>
  [
    organizationClient({ teams: { enabled: true } }),
    multiSessionClient(),
    apiKeyClient(),
    twoFactorClient(),
  ] as const;
type ClientOptions<Extensions extends BetterAuthClientPlugin[]> = Omit<
  BetterAuthClientOptions,
  'plugins'
> & { plugins: [...ReturnType<typeof standardPlugins>, ...Extensions] };

/** Standard client preset. The server must enable the corresponding native extensions. */
export function createBetterAuthClient<const Extensions extends BetterAuthClientPlugin[] = []>(
  options: Omit<BetterAuthClientOptions, 'plugins'> & { plugins?: Extensions } = {},
): ReactAuthClient<ClientOptions<Extensions>> {
  return createAuthClient<ClientOptions<Extensions>>({
    ...options,
    plugins: [
      ...standardPlugins(),
      ...(options.plugins ?? []),
    ] as ClientOptions<Extensions>['plugins'],
  });
}
