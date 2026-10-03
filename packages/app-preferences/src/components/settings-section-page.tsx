'use client';
import type { ComponentType } from 'react';
import type { SettingsCatalogSection } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';
import { SettingsFields } from './settings-fields.js';

export type SettingsSectionPageProps = {
  section: SettingsCatalogSection;
  /** Render the section title and description as the page header. Default: true. */
  showHeader?: boolean;
};

/**
 * One settings page: the header, then the plugin's `ui/settings/page.tsx` when it has one
 * (it receives `{ section }`), otherwise the generated fields.
 */
export function SettingsSectionPage({ section, showHeader = true }: SettingsSectionPageProps) {
  const Page = section.component as ComponentType<{ section: SettingsCatalogSection }> | undefined;
  return (
    <div data-settings-section={section.id} className="flex w-full min-w-0 flex-col gap-6">
      {showHeader && <PageHeader title={section.title} subtitle={section.description} />}
      {Page ? <Page section={section} /> : <SettingsFields section={section} />}
    </div>
  );
}
