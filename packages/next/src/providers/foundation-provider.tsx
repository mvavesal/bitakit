'use client';
import { defineFramework, type FrameworkProviderProps } from '@bitakit/ui';
import { useActionNavigation } from '../routing/use-action-navigation.js';
import { QueryProvider } from '../query.js';

export type NextFoundationProviderProps = FrameworkProviderProps;

/**
 * Next routing and query state on the shared runtime. The generated `BitaKitProvider` in
 * `src/bitakit.gen.tsx` passes the discovered configuration; use this directly only with an
 * explicit `config`.
 */
export const next = defineFramework({
  id: 'next',
  useRouter: useActionNavigation,
  QueryState: QueryProvider,
});
export const FoundationProvider = next.FoundationProvider;
