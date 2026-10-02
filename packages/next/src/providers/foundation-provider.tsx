'use client';
import {
  StandardFoundationProvider,
  type StandardFoundationProviderProps,
} from '@bitakit/ui/components';
import { useActionNavigation } from '../routing/use-action-navigation.js';
import { QueryProvider } from '../query.js';

export type NextFoundationProviderProps = StandardFoundationProviderProps & {
  /** Disable only when an outer QueryProvider already owns query state. */
  queryState?: boolean;
};

/**
 * Connects Next routing and query state to the shared UI runtime. The generated
 * `BitaKitProvider` in `src/bitakit.gen.tsx` passes the discovered configuration; use this
 * directly only with an explicit `config`.
 */
export function FoundationProvider({
  config,
  actionOptions,
  queryState = true,
  ...props
}: NextFoundationProviderProps) {
  const navigation = useActionNavigation();
  if (!config)
    throw new Error(
      "FoundationProvider needs a configuration. Use <BitaKitProvider> from './bitakit.gen', or pass config={createBitaKitConfig()}.",
    );
  const content = (
    <StandardFoundationProvider
      {...props}
      config={config}
      actionOptions={{ ...navigation, ...actionOptions }}
    />
  );
  return queryState ? <QueryProvider>{content}</QueryProvider> : content;
}
