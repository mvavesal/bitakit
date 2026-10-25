'use client';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createLocalSettingsStorage } from '@bitakit/core';
import { useAction, useBitaKit, useRuntimeInventory, useService } from '@bitakit/ui';
import { setLocale } from '@/i18n/set-locale';
import { ReturnBar } from './return-bar';
import {
  defaults,
  switchablePlugins,
  type PlaygroundCommand,
  type PlaygroundState,
} from '@/playground/protocol';

const noThemes = { list: () => [], active: () => undefined, subscribe: () => () => {} };
const foundationPlugins = new Set(['app', 'dashboard', 'shell', 'app-preferences', 'next-intl']);

/**
 * One runtime snapshot and command handler serve both the framed and standalone demo.
 * The parent receives the snapshot over the existing checked message bridge; the standalone
 * inspector receives it directly. Settings and plugin state remain owned by BitaKit.
 */
export function PlaygroundBridge() {
  const { runtime } = useBitaKit();
  const router = useRouter();
  const path = usePathname();
  const locale = useLocale();
  const inventory = useRuntimeInventory();
  // Preserve the original dependency order, then include every newly discovered demo feature.
  const switchable = useMemo(
    () => [
      ...switchablePlugins,
      ...inventory.static.plugins
        .map((plugin) => plugin.id)
        .filter(
          (id) =>
            !foundationPlugins.has(id) && !(switchablePlugins as readonly string[]).includes(id),
        ),
    ],
    [inventory.static.plugins],
  );
  const selectTheme = useAction('shell.selectTheme');
  const themes = useService('shell.themes') ?? noThemes;
  const activeTheme = useSyncExternalStore(
    themes.subscribe,
    () => themes.active()?.key ?? '',
    () => '',
  );
  // One subscription per reported setting; the snapshot is a string so React can compare it.
  const settingsJson = useSyncExternalStore(
    (listener) => {
      const stops = Object.keys(defaults.settings).map((key) =>
        runtime.settings.subscribe(key as never, listener),
      );
      return () => stops.forEach((stop) => stop());
    },
    () =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(defaults.settings).map((key) => [
            key,
            runtime.settings.state(key as never).value,
          ]),
        ),
      ),
    () => '{}',
  );

  const state = useMemo<PlaygroundState>(() => {
    const plugins = inventory.static.plugins;
    return {
      type: 'bitakit:state',
      path,
      locale,
      settings: JSON.parse(settingsJson),
      themes: themes.list().map((theme) => ({ key: theme.key, name: theme.name })),
      theme: activeTheme,
      plugins: switchable.map((id) => ({
        id,
        enabled: plugins.find((plugin) => plugin.id === id)?.enabled ?? false,
      })),
    };
  }, [inventory, path, locale, settingsJson, activeTheme, themes, switchable]);

  // Report after every change; both inspectors render only what the runtime says is true.
  const reportState = useCallback(() => {
    if (window.parent !== window) window.parent.postMessage(state, window.location.origin);
  }, [state]);

  // Demo-only first-visit choice. Read the existing storage contract and write through
  // the runtime; an explicit stored light, dark or system choice always takes precedence.
  useEffect(() => {
    let initialized = false;
    const initialize = () => {
      if (initialized) return;
      const state = runtime.settings.state('shell.mode');
      if (!state.ready || state.pending) return;
      initialized = true;
      const stored = createLocalSettingsStorage().load('shell.mode', { scope: 'device' });
      if (!(stored instanceof Promise) && stored.value === undefined)
        void runtime.settings.set('shell.mode', defaults.settings['shell.mode']);
    };
    const stop = runtime.settings.subscribe('shell.mode', initialize);
    initialize();
    return stop;
  }, [runtime]);

  const execute = useCallback(
    async (command: PlaygroundCommand) => {
      switch (command?.type) {
        case 'bitakit:setting':
          await runtime.settings.set(command.key as never, command.value as never);
          break;
        case 'bitakit:theme':
          await selectTheme?.execute({ key: command.key });
          break;
        case 'bitakit:plugin':
          if (!switchable.includes(command.id)) return;
          if (command.enabled) await runtime.plugins.enable(command.id);
          else await runtime.plugins.disable(command.id, { dependents: 'stop' });
          break;
        case 'bitakit:locale':
          await setLocale(command.locale);
          router.refresh();
          break;
        case 'bitakit:navigate':
          if (command.href.startsWith('/') && !command.href.startsWith('//'))
            router.push(command.href);
          break;
        case 'bitakit:reset':
          // Sequential: a plugin that requires another starts after it.
          for (const id of switchable) await runtime.plugins.enable(id);
          for (const [key, value] of Object.entries(defaults.settings))
            await runtime.settings.set(key as never, value as never);
          await selectTheme?.execute({ key: defaults.theme });
          if (locale !== defaults.locale) {
            await setLocale(defaults.locale);
            router.refresh();
          }
          router.push(defaults.path);
          break;
        case 'bitakit:hello':
          reportState();
          break;
      }
    },
    [runtime, router, selectTheme, locale, reportState, switchable],
  );

  useEffect(() => {
    if (window.parent === window) return;
    const onMessage = (event: MessageEvent<PlaygroundCommand>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      void execute(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [execute]);

  useEffect(() => reportState(), [reportState]);

  return <ReturnBar state={state} send={execute} />;
}
