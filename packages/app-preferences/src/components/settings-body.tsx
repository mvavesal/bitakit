'use client';
import type { ComponentType, ReactNode } from 'react';
import {
  useSettingsCatalog,
  SlotErrorBoundary,
  type SlotProps,
  type SettingsCatalogField,
  type SettingsCatalogSection,
} from '@bitakit/ui';
import { SettingField } from './setting-field.js';
import { SettingsFields } from './settings-fields.js';

/** Catalog projection only: current page content is never copied into another registry. */
export function SettingsBody({ payload }: SlotProps<'app-preferences.page.body'>) {
  const section = useSettingsCatalog().find((item) => item.id === payload.pageId);
  if (!section) return null;
  const Page = section.component as
    | ComponentType<{
        section: SettingsCatalogSection;
        renderField: (field: SettingsCatalogField) => ReactNode;
      }>
    | undefined;
  return (
    <SlotErrorBoundary
      slot="app-preferences.page.body"
      plugin={section.plugin}
      contribution={section.id}
    >
      {Page ? (
        <Page
          section={section}
          renderField={(field) => <SettingField key={field.key} field={field} />}
        />
      ) : (
        <SettingsFields section={section} />
      )}
    </SlotErrorBoundary>
  );
}
