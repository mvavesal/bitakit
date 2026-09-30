'use client';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SettingsNavigation as SharedNavigation } from '@bitakit/shell/settings';
import { SettingsLink } from './settings-link';

export function SettingsNavigation() {
  const t = useTranslations('Settings');
  return (
    <SharedNavigation
      pathname={usePathname()}
      linkComponent={SettingsLink}
      labels={{ navigation: t('navigation'), empty: t('empty') }}
    />
  );
}
