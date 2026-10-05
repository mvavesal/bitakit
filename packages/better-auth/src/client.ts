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
    fetchOptions: {
      ...options.fetchOptions,
      async onSuccess(context) {
        // Native session cards require a nonempty UA even though Better Auth permits null.
        // Preserve every session and permission; only supply an unknown display value.
        if (
          new URL(context.request.url, 'http://localhost').pathname.endsWith('/list-sessions') &&
          Array.isArray(context.data)
        ) {
          for (const session of context.data) {
            if (
              session &&
              typeof session === 'object' &&
              (typeof session.userAgent !== 'string' || !session.userAgent.trim())
            )
              session.userAgent = 'Unknown';
          }
        }
        await options.fetchOptions?.onSuccess?.(context);
      },
    },
    plugins: [
      ...standardPlugins(),
      ...(options.plugins ?? []),
    ] as ClientOptions<Extensions>['plugins'],
  });
}
