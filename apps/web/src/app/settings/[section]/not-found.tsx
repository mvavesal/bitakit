import { PageHeader } from '@/components/layout/page-header';
import { useTranslations } from 'next-intl';
import { SettingsLink } from '@/components/settings/base/settings-link';
import { Button } from '@/components/ui/button';

export default function MissingSettingsSection() {
  const t = useTranslations('Settings');
  return (
    <div className="flex flex-col items-start gap-4">
      <PageHeader title={t('missing')} subtitle={t('missingDescription')} />
      <Button variant="outline" asChild>
        <SettingsLink href="/settings">{t('all')}</SettingsLink>
      </Button>
    </div>
  );
}
