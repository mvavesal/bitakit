'use client';
import { useTranslations } from 'next-intl';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

// App text comes from locales/<lang>.json; the link's title from the tasks plugin's catalog.
export default function Home() {
  const t = useTranslations('home');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ActionLink action="tasks.open" />
    </>
  );
}
