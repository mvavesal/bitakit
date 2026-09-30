'use client';
import {
  SettingsSectionView,
  useSettingsSections,
  useSettingsText,
} from '@bitakit/app-preferences';
import { PageHeader } from '../components/ui/index.js';
import type { ReactNode } from 'react';

/** Direct access follows the same catalog availability as navigation. */
export function SettingsPage({
  pathname,
  unavailable,
}: {
  pathname: string;
  unavailable: ReactNode;
}) {
  const text = useSettingsText();
  const section = useSettingsSections().find((section) => `/settings/${section.path}` === pathname);
  if (!section?.visible || !section.enabled) return <p role="status">{unavailable}</p>;
  return (
    <>
      {section.showHeader && (
        <PageHeader
          title={text.sectionTitle(section)}
          subtitle={text.sectionDescription(section)}
        />
      )}
      <SettingsSectionView section={section} />
    </>
  );
}
