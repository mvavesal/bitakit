import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import {
  StandardFoundationProvider,
  type StandardFoundationProviderProps,
} from '@bitakit/ui/components';
import { useActionNavigation } from '../routing/navigation.js';

export type TanStackFoundationProviderProps = StandardFoundationProviderProps & {
  queryState?: boolean;
};

/**
 * Mount inside TanStack's router context. The generated `BitaKitProvider` in
 * `src/bitakit.gen.tsx` passes the discovered configuration; use this directly only with an
 * explicit `config`.
 */
export function FoundationProvider({
  config,
  actionOptions,
  queryState = true,
  ...props
}: TanStackFoundationProviderProps) {
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
  return queryState ? <NuqsAdapter>{content}</NuqsAdapter> : content;
}
