'use client';
import { useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Setting } from '../fields/setting.js';
import type { SettingsSection } from '../catalog/section.js';
import {
  SettingsRendererRegistry,
  type RendererSnapshot,
  type SettingsRendererSet,
} from '../renderers/registry.js';
import { builtInRenderers } from '../renderers/defaults.js';
import { resolveLocalized, type SettingsTranslator } from '../text.js';
import { defaultSettingsMessages, formatMessage, type SettingsMessages } from './messages.js';
import { SettingsUIContext, type SettingsUIValue } from './context.js';
export { SettingsUIContext } from './context.js';
export type { SettingsStaticState, SettingsUIValue } from './context.js';

let builtins: RendererSnapshot | undefined;
/** The built-in controls never change, so their snapshot is immutable and safe to share. */
function builtinSnapshot() {
  builtins ??= new SettingsRendererRegistry(builtInRenderers).getSnapshot();
  return builtins;
}
/** Creates an application-scoped registry with the built-in controls and optional app renderers. */
export function createSettingsRenderers(app?: SettingsRendererSet) {
  const registry = new SettingsRendererRegistry(builtInRenderers);
  if (app) registry.registerSet(app, { layer: 'app', origin: 'the application renderers' });
  return registry;
}
const noSubscription = () => () => {};
/** Standalone hosts: supplies renderers, translation and messages to the default views. */
export function SettingsUIProvider({
  renderers,
  translate,
  messages,
  children,
}: {
  renderers?: SettingsRendererRegistry;
  translate?: SettingsTranslator;
  messages?: Partial<SettingsMessages>;
  children: ReactNode;
}) {
  const snapshot = useSyncExternalStore(
    renderers?.subscribe ?? noSubscription,
    renderers?.getSnapshot ?? builtinSnapshot,
    renderers?.getSnapshot ?? builtinSnapshot,
  );
  const value = useMemo<SettingsUIValue>(
    () => ({
      renderers: snapshot,
      translate,
      messages: { ...defaultSettingsMessages, ...messages },
    }),
    [snapshot, translate, messages],
  );
  return <SettingsUIContext.Provider value={value}>{children}</SettingsUIContext.Provider>;
}
const fallback: { value?: SettingsUIValue } = {};
export function useSettingsUI(): SettingsUIValue {
  const value = useContext(SettingsUIContext);
  if (value) return value;
  fallback.value ??= {
    renderers: builtinSnapshot(),
    messages: defaultSettingsMessages,
  };
  return fallback.value;
}
/** Translated texts for definitions and sections: explicit key, conventional key, fallback. */
export function settingsText(translate: SettingsTranslator | undefined) {
  const optional = (keys: readonly (string | undefined)[], text: string | undefined) => {
    const resolved = resolveLocalized(translate, keys, text ?? '');
    return resolved || undefined;
  };
  return {
    fieldLabel: (setting: Setting<any>) =>
      resolveLocalized(translate, [setting.titleKey, `${setting.key}.title`], setting.title),
    fieldDescription: (setting: Setting<any>) =>
      optional([setting.descriptionKey, `${setting.key}.description`], setting.description),
    option: (
      setting: Setting<any>,
      option: {
        value: string;
        label: string;
        labelKey?: string;
        description?: string;
        descriptionKey?: string;
      },
    ) => ({
      value: option.value,
      label: resolveLocalized(
        translate,
        [
          option.labelKey,
          `${setting.key}.options.${option.value}.label`,
          `${setting.key}.options.${option.value}`,
        ],
        option.label,
      ),
      description: optional(
        [option.descriptionKey, `${setting.key}.options.${option.value}.description`],
        option.description,
      ),
    }),
    sectionTitle: (section: SettingsSection) =>
      resolveLocalized(
        translate,
        [section.titleKey, `settings.sections.${section.id}.title`],
        section.title,
      ),
    sectionDescription: (section: SettingsSection) =>
      optional(
        [section.descriptionKey, `settings.sections.${section.id}.description`],
        section.description,
      ),
  };
}
export function useSettingsText() {
  const { translate, messages } = useSettingsUI();
  return useMemo(
    () => ({
      ...settingsText(translate),
      message: (name: keyof SettingsMessages, values?: Readonly<Record<string, string>>) =>
        formatMessage(
          resolveLocalized(translate, [`settings.messages.${name}`], messages[name]),
          values,
        ),
    }),
    [translate, messages],
  );
}
