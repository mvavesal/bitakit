'use client';
import type { ReactNode } from 'react';
import type { SettingsCatalogField, SettingsCatalogSection } from '@bitakit/app-preferences';

// Replaces the body of the generated /settings/greeting page; URL and navigation stay.
export default function GreetingSettingsPage({
  section,
  renderField,
}: {
  section: SettingsCatalogSection;
  renderField: (field: SettingsCatalogField) => ReactNode;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        These choices are saved in this browser. Open the Greeting page to see them applied.
      </p>
      {section.fields.map(renderField)}
    </>
  );
}
