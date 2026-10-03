'use client';
import { useSettingsCatalog } from '@bitakit/ui';
import { visibleSections } from '../catalog.js';
import { normalizePath, sectionHref } from '../paths.js';
import { useSettingsLocation } from './location.js';
import { SettingsSectionPage } from './settings-section-page.js';
import { useMessages } from './use-messages.js';

export type SettingsPageProps = {
  basePath?: string;
  /** The current path; the router's pathname when omitted. */
  pathname?: string;
  /** Shown for a path that names no settings page. */
  unavailable?: string;
};

/** The settings page at `pathname`: the section whose `${basePath}/${path}` matches it. */
export function SettingsPage({ basePath, pathname, unavailable }: SettingsPageProps) {
  const location = useSettingsLocation({ basePath, pathname });
  const messages = useMessages();
  const sections = visibleSections(useSettingsCatalog());
  const current = location.pathname === undefined ? undefined : normalizePath(location.pathname);
  const section = sections.find((entry) => sectionHref(location.basePath, entry) === current);
  if (!section)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {unavailable ?? messages('unavailable')}
      </p>
    );
  return <SettingsSectionPage key={section.id} section={section} />;
}
