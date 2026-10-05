// Type-level checks for the public API; compiled by `tsc -p tsconfig.test.json`, never run.
import type { ComponentType } from 'react';
import {
  CardsControl,
  NumberControl,
  SettingField,
  SettingsFields,
  SettingsOverview,
  SettingsRoute,
  SettingsShell,
  SwitchControl,
  controlFor,
  settingsCategories,
  type SettingControlProps,
  type SettingsCatalogField,
  type SettingsCatalogSection,
} from '../src/index.js';
import appPreferencesPlugin, { type AppPreferencesPluginOptions } from '../src/foundation.js';

declare const field: SettingsCatalogField;
declare const section: SettingsCatalogSection;

// Controls take the value type of their setting.
const toggle: ComponentType<SettingControlProps<boolean>> = SwitchControl;
const count: ComponentType<SettingControlProps<number>> = NumberControl;
const cards: ComponentType<SettingControlProps<unknown>> = CardsControl;
// @ts-expect-error a switch does not edit numbers
const wrong: ComponentType<SettingControlProps<number>> = SwitchControl;
const inferred: ComponentType<SettingControlProps<any>> | undefined = controlFor(field);

// A custom control is a component of the same props.
function Stars({ value, onChange, disabled, id }: SettingControlProps<number>) {
  void [value, onChange, disabled, id];
  return null;
}
const custom: ComponentType<SettingControlProps<number>> = Stars;

// SettingField takes a catalog field or a key, not both.
const byField = <SettingField field={field} />;
const byKey = <SettingField settingKey="todos.pageSize" />;
// @ts-expect-error field and settingKey exclude each other
const both = <SettingField field={field} settingKey="todos.pageSize" />;

const fields = <SettingsFields section={section} exclude={['todos.pageSize']} />;
const overview = <SettingsOverview basePath="/settings" query="" showSearch={false} />;
const shell = (
  <SettingsShell basePath="/settings" embedded>
    content
  </SettingsShell>
);
const route = <SettingsRoute basePath="/preferences" backHref="/" linkComponent="a" />;

const options: AppPreferencesPluginOptions = { basePath: '/settings', groups: ['navigation'] };
const plugin = appPreferencesPlugin(options);
const id: 'app-preferences' = plugin.id;
const order: number = settingsCategories[0]!.order;

void [toggle, count, cards, wrong, inferred, custom, byField, byKey, both, fields, overview];
void [shell, route, id, order];

import { defineAction, type SlotPredicate } from '@bitakit/core';
import { PluginSlot, useSlot } from '@bitakit/ui';
const historyOnly: SlotPredicate<'app-preferences.page.after'> = ({ payload }) => payload.pageId === 'billing/history';
const body = <PluginSlot name="app-preferences.page.body" entryKey="billing" payload={{ pageId: 'billing' }} />;
// @ts-expect-error page body requires a typed page payload
const noPage = <PluginSlot name="app-preferences.page.body" entryKey="billing" />;
const exportPage = defineAction<string>({ slots: [{ name: 'app-preferences.page.toolbar', input: ({ payload }) => payload.pageId }], execute: ({ input }) => input });
void [historyOnly, body, noPage, exportPage, useSlot];
