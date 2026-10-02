'use client';
import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { getService, type FoundationRuntime } from '@bitakit/core';
import { useFoundation, useTranslation } from '@bitakit/ui';
import type { Setting } from '../fields/setting.js';
import { settingsOf } from '../fields/builders.js';
import { SettingsRendererRegistry, type SettingsRendererSet } from '../renderers/registry.js';
import { builtInRenderers } from '../renderers/defaults.js';
import {
  SettingsUIContext,
  type SettingsStaticState,
  type SettingsUIValue,
} from '../react/context.js';
import type { SettingsMessages } from '../react/messages.js';
import { settingsRendererService } from '../services/renderers.js';
import { ownedSection } from '../foundation/ownership.js';
import { originOf } from '../foundation/origins.js';
import type { AppPreferences } from '../app-preferences.js';
import { SettingsProvider, useOptionalSettings } from '../react/provider.js';

type StaticSnapshot = {
  renderers: ReturnType<SettingsRendererRegistry['getSnapshot']>;
  state: SettingsStaticState;
};
/**
 * Pure and instance scoped: derived from the runtime's declarative contributions in install order,
 * exactly as the installers will apply them, so server, hydration and post-mount renders agree.
 */
export function createInitialSettingsSnapshot(
  runtime: FoundationRuntime,
  defaults: SettingsRendererSet = builtInRenderers,
): StaticSnapshot {
  const owners = new Map<string, string[]>();
  const settings = new Set<Setting<any>>();
  for (const { module, values } of runtime.contributionsOf('settings'))
    for (const setting of settingsOf(values)) {
      settings.add(setting);
      const list = owners.get(setting.key) ?? [];
      if (!list.includes(module)) owners.set(setting.key, [...list, module]);
    }
  const sections = runtime
    .contributionsOf('settings.sections')
    .flatMap(({ module, values }) =>
      values.map((section) => ownedSection(section, module, originOf(section, `"${module}"`))),
    );
  const registry = new SettingsRendererRegistry(defaults);
  for (const { module, app, values } of runtime.contributionsOf('settings.renderers'))
    for (const set of values)
      registry.registerSet(set, {
        layer: app ? 'app' : 'plugin',
        owner: module,
        origin: originOf(set, `"${module}"`),
      });
  return {
    renderers: registry.getSnapshot(),
    state: Object.freeze({
      settings,
      owners: (key: string) => owners.get(key) ?? [],
      sections: Object.freeze(sections),
    }),
  };
}
const idle = () => () => {};
export function createBridge(
  messages: SettingsMessages,
  defaults: SettingsRendererSet,
  settings?: AppPreferences,
) {
  return function SettingsBridge({ children }: { children: ReactNode }) {
    const inherited = useOptionalSettings();
    const { runtime } = useFoundation();
    const initial = useMemo(() => createInitialSettingsSnapshot(runtime, defaults), [runtime]);
    const ready = useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
    const service = ready ? getService(runtime.services, settingsRendererService) : undefined;
    const translate = useTranslation();
    const renderers = useSyncExternalStore(
      service?.subscribe ?? idle,
      service?.getSnapshot ?? (() => initial.renderers),
      () => initial.renderers,
    );
    const value = useMemo<SettingsUIValue>(
      () => ({
        renderers,
        translate,
        messages: Object.fromEntries(
          Object.entries(messages).map(([key, fallback]) => {
            const raw = translate.getCatalog('settings.messages')?.[key];
            return [
              key,
              typeof raw === 'string'
                ? raw
                : translate(`settings.messages.${key}`, undefined, fallback),
            ];
          }),
        ) as SettingsMessages,
        initial: ready ? undefined : initial.state,
      }),
      [renderers, ready, initial, translate, messages],
    );
    const content = (
      <SettingsUIContext.Provider value={value}>{children}</SettingsUIContext.Provider>
    );
    // Existing hosts keep their identity-scoped provider; minimal hosts need no extra wrapper.
    return inherited || !settings ? (
      content
    ) : (
      <SettingsProvider settings={settings}>{content}</SettingsProvider>
    );
  };
}
