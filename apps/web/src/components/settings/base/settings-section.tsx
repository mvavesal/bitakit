'use client';

import { PageHeader } from '@/components/layout/page-header';
import { useTranslations } from 'next-intl';

import { useSettingsSections, SettingsSectionContent } from '@bitakit/app-preferences';
import { useFoundationReady } from '@bitakit/ui';
import { notFound } from 'next/navigation';

export function SettingsSection({ section }: { section: string }) {
  const t = useTranslations('Settings');
  const ready = useFoundationReady();
  const action = useSettingsSections().find((item) => item.path === section);
  // Trusted runtime contributions may register after the first client render.
  if (!action && !ready) return null;
  if (!action || !action.visible) notFound();
  return (
    <>
      <title>{`${action.title} · SaaS Foundation`}</title>
      {action.showHeader && <PageHeader title={action.title} subtitle={action.description} />}
      {action.enabled ? (
        <SettingsSectionContent section={action} />
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {t('unavailable')}
        </p>
      )}
    </>
  );
}
