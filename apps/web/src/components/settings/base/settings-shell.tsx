'use client';
import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SettingsShell as SharedSettingsShell } from '@bitakit/shell/settings';
import { SettingsLink } from './settings-link';

export function SettingsShell({
  children,
  embedded = false,
}: {
  children: ReactNode;
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations('Settings');
  return (
    <SharedSettingsShell
      pathname={pathname}
      linkComponent={SettingsLink}
      backHref="/app-preview"
      embedded={embedded}
      labels={{
        title: t('title'),
        back: t('back'),
        navigation: t('navigation'),
        toggle: t('toggleNavigation'),
        breadcrumb: t('breadcrumb'),
        search: t('search'),
        placeholder: t('placeholder'),
        clear: t('clear'),
        empty: t('empty'),
        skip: t('skip'),
      }}
    >
      {children}
    </SharedSettingsShell>
  );
}
