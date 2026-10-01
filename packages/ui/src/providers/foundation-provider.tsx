'use client';
import { createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useActionList } from '@bitakit/ui/actions';
import type { FoundationConfig } from '@bitakit/core';
import type { FoundationProviderProps } from '../types/provider.js';
import { ActionContext } from './action-context.js';
import { ActionProvider } from './action-provider.js';
import { FoundationRuntime } from '@bitakit/core';
import { FoundationContext, type SignOutIntent } from './foundation-context.js';
import { DialogHost } from '../components/dialog-host.js';
import { resolveFoundationConfig } from '@bitakit/core';
const ignore = () => {};
const noServices = {};
const emptyConfig: FoundationConfig = {};
/** Owns the root ActionProvider, or reuses an existing host provider during migration. */
export function FoundationProvider({ actionOptions, ...props }: FoundationProviderProps) {
  const actions = useContext(ActionContext);
  const content = <FoundationRuntimeProvider {...props} />;
  return actions ? content : <ActionProvider {...actionOptions}>{content}</ActionProvider>;
}

/** Mounts one runtime against the selected ActionList; configuration is immutable. */
function FoundationRuntimeProvider({
  config = emptyConfig,
  actions: explicitActions,
  plugins,
  interceptors,
  providers,
  ui,
  translate,
  labels,
  notify,
  services = noServices,
  children,
}: FoundationProviderProps) {
  const actions = useActionList();
  const [signOutIntent, setSignOutIntent] = useState<SignOutIntent>(null);
  const selected = useMemo(
    () =>
      resolveFoundationConfig(config, {
        actions: explicitActions,
        plugins,
        interceptors,
        providers,
      }),
    [config, explicitActions, plugins, interceptors, providers],
  );
  if (
    translate &&
    (services.i18n ||
      selected.plugins?.some((integration) =>
        integration.services?.some((service) => service.id === 'i18n'),
      ))
  )
    throw new Error('Use either a translation plugin or the translate prop, not both.');
  const runtime = useMemo(
    () => new FoundationRuntime(actions, selected, services),
    [actions, selected, services],
  );
  useEffect(() => {
    if (translate) runtime.setTranslations(translate);
  }, [runtime, translate]);
  useEffect(() => (notify ? runtime.setNotifier(notify) : undefined), [runtime, notify]);
  useEffect(() => {
    const stop = runtime.mount();
    return () => { setSignOutIntent(null); stop(); };
  }, [runtime]);
  return (
    <FoundationContext.Provider value={{ runtime, ui, labels, notify: notify ?? ignore, signOutIntent, setSignOutIntent }}>
      {(selected.providers ?? []).reduceRight<ReactNode>(
        (content, provider) =>
          createElement(provider.component, { children: content, key: provider.id }),
        <>
          {children}
          <DialogHost />
        </>,
      )}
    </FoundationContext.Provider>
  );
}
