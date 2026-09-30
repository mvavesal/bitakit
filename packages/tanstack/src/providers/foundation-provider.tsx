import { useMemo } from 'react';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import {
  StandardFoundationProvider,
  type StandardFoundationProviderProps,
} from '@bitakit/ui/components';
import { createFoundationConfig } from '@bitakit/tanstack/generated';
import { useActionNavigation } from '../routing/navigation.js';

export type TanStackFoundationProviderProps = StandardFoundationProviderProps & {
  queryState?: boolean;
};

/** Mount inside TanStack's router context; Core lifecycle remains owned by the shared provider. */
export function FoundationProvider({
  config,
  actionOptions,
  queryState = true,
  ...props
}: TanStackFoundationProviderProps) {
  const navigation = useActionNavigation();
  const selectedConfig = useMemo(
    () => config ?? createFoundationConfig(),
    [config, createFoundationConfig],
  );
  const content = (
    <StandardFoundationProvider
      {...props}
      config={selectedConfig}
      actionOptions={{ ...navigation, ...actionOptions }}
    />
  );
  return queryState ? <NuqsAdapter>{content}</NuqsAdapter> : content;
}
