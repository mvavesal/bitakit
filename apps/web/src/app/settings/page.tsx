import { PageHeader } from '@/components/layout/page-header';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SettingsOverview } from '@/components/settings/base/settings-overview';
import { Skeleton } from '@/components/ui/skeleton';

export async function generateMetadata() {
  const t = await getTranslations('Settings');
  return { title: `${t('title')} · SaaS Foundation` };
}

export default async function SettingsPage() {
  const t = await getTranslations('Settings');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('intro')} />
      <Suspense fallback={<Skeleton className="h-36 w-full" aria-label={t('loading')} />}>
        <SettingsOverview />
      </Suspense>
    </>
  );
}
