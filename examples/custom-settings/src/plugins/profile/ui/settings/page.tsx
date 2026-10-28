'use client';
import { SettingsFields, type SettingsCatalogSection } from '@bitakit/app-preferences';
import { ProfileCard } from '../profile-card';

// Replaces the body of the generated /settings/profile page: a live preview above the
// generated fields, which keep their controls, groups, saving state, errors and reset.
export default function ProfileSettingsPage({ section }: { section: SettingsCatalogSection }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Preview" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Preview</h2>
        <ProfileCard />
      </section>
      <SettingsFields section={section} />
    </div>
  );
}
