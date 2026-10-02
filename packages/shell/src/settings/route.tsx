'use client';
import type { ElementType } from 'react';
import { useFoundationNavigation, useTranslation } from '@bitakit/ui';
import { useSettingsSections } from '@bitakit/app-preferences';
import { SettingsShell } from './shell.js';
import { SettingsPage } from './page.js';

/**
 * A complete settings route in one component: navigation, breadcrumb and the current section.
 * The framework adapter supplies pathname and links; `/settings` shows the first available
 * section, so no redirect route is needed.
 */
export function SettingsRoute({
  backHref = '/',
  pathname,
  linkComponent,
}: {
  backHref?: string;
  pathname?: string;
  linkComponent?: ElementType;
}) {
  const navigation = useFoundationNavigation();
  const t = useTranslation();
  const sections = useSettingsSections();
  const current = pathname ?? navigation.pathname ?? '/settings';
  const first = sections.find((section) => section.visible && section.enabled);
  const resolved = /^\/settings\/?$/.test(current) && first ? `/settings/${first.path}` : current;
  return (
    <SettingsShell
      pathname={resolved}
      linkComponent={linkComponent ?? navigation.Link ?? 'a'}
      backHref={backHref}
    >
      <SettingsPage
        pathname={resolved}
        unavailable={t('shell.settingsRoute.unavailable', undefined, 'This setting is unavailable.')}
      />
    </SettingsShell>
  );
}
