'use client';

import { useSettingsSections } from '@bitakit/app-preferences';
import { useTranslations } from 'next-intl';
import { SettingsLink } from '@/components/settings/base/settings-link';
import { Button } from '@/components/ui/button';

export function PluginsSettings() {
  const t = useTranslations('PluginsSettings');
  const pages = useSettingsSections().filter((section) => section.visible && section.pluginId);
  if (!pages.length) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <div className="flex flex-col items-start gap-2">
      {pages.map((page) => (
        <Button key={page.id} variant="outline" disabled={!page.enabled} asChild>
          <SettingsLink
            href={page.enabled ? `/settings/${page.path}` : '#'}
            aria-disabled={!page.enabled || undefined}
            tabIndex={page.enabled ? undefined : -1}
          >
            {page.icon && <page.icon aria-hidden="true" />}
            {page.title}
          </SettingsLink>
        </Button>
      ))}
    </div>
  );
}
