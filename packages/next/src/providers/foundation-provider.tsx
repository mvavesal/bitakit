'use client';
import { useMemo } from 'react';
import {
  StandardFoundationProvider,
  type StandardFoundationProviderProps,
} from '@bitakit/ui/components';
import { createFoundationConfig } from '@bitakit/next/generated';
import { useActionNavigation } from '../routing/use-action-navigation.js';
import { QueryProvider } from '../query.js';

export type NextFoundationProviderProps = StandardFoundationProviderProps & {
  /** Disable only when an outer QueryProvider already owns query state. */
  queryState?: boolean;
};

/** Connects Next routing, query state and generated contributions to the shared UI runtime. */
export function FoundationProvider({
  config,
  actionOptions,
  queryState = true,
  ...props
}: NextFoundationProviderProps) {
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
  return queryState ? <QueryProvider>{content}</QueryProvider> : content;
}
