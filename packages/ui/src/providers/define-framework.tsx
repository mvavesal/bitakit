'use client';
import type { ComponentType, ReactNode } from 'react';
import { BitaKitRuntimeProvider } from './foundation-provider.js';
import type { BitaKitRuntimeProviderProps } from '../types/provider.js';

/** What a framework adapter supplies to the shared runtime. Values re-render with the router. */
export type Router = {
  pathname?: string;
  /** Dynamic segments of the current route, for example `{ id: '42' }`. */
  params?: Readonly<Record<string, string>>;
  navigate?: (href: string, options?: { replace?: boolean }) => void;
  Link?: ComponentType<any>;
};
export type FrameworkDefinition = {
  id: string;
  /** Hook reading the host router; called on every render of the provider. */
  useRouter(): Router;
  /** Wraps the app with the framework's URL query-state adapter (nuqs). */
  QueryState?: ComponentType<{ children: ReactNode }>;
};
export type FrameworkProviderProps = BitaKitRuntimeProviderProps & {
  /** Disable only when an outer query-state adapter already owns URL state. */
  queryState?: boolean;
};
export type Framework = FrameworkDefinition & {
  BitaKitRuntimeProvider: (props: FrameworkProviderProps) => ReactNode;
};

/**
 * Builds a framework adapter: the provider that connects the host router (pathname, params,
 * navigate, Link) and query state to the shared runtime. `@bitakit/next` and
 * `@bitakit/tanstack` are two calls of this; a third framework needs only a router hook.
 */
export function defineFramework(definition: FrameworkDefinition): Framework {
  function FrameworkRuntimeProvider({
    config,
    actionOptions,
    queryState = true,
    ...props
  }: FrameworkProviderProps) {
    const router = definition.useRouter();
    if (!config)
      throw new Error(
        "BitaKitRuntimeProvider needs a configuration. Use <BitaKitProvider> from './bitakit.gen', or pass config={createBitaKitConfig()}.",
      );
    const content = (
      <BitaKitRuntimeProvider
        {...props}
        config={config}
        actionOptions={{ ...router, ...actionOptions }}
      />
    );
    const QueryState = definition.QueryState;
    return queryState && QueryState ? <QueryState>{content}</QueryState> : content;
  }
  FrameworkRuntimeProvider.displayName = `${definition.id}.BitaKitRuntimeProvider`;
  return { ...definition, BitaKitRuntimeProvider: FrameworkRuntimeProvider };
}
