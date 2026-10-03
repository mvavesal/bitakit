import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import { defineFramework, type FrameworkProviderProps } from '@bitakit/ui';
import { useActionNavigation } from '../routing/navigation.js';

export type TanStackFoundationProviderProps = FrameworkProviderProps;

/**
 * Mount inside TanStack's router context. The generated `BitaKitProvider` in
 * `src/bitakit.gen.tsx` passes the discovered configuration; use this directly only with an
 * explicit `config`.
 */
export const tanstack = defineFramework({
  id: 'tanstack',
  useRouter: useActionNavigation,
  QueryState: NuqsAdapter,
});
export const FoundationProvider = tanstack.FoundationProvider;
