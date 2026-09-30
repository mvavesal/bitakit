'use client';
import { useTranslations } from 'next-intl';
import { useSetting, SettingsField } from '@bitakit/app-preferences';
import { localeSetting } from '../../definitions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

export function LanguageSettings() {
  const t = useTranslations('Language');
  const action = useSetting(localeSetting);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('label')}</h2>
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>{action?.visible && <SettingsField setting={localeSetting} />}</CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {t(action?.pending ? 'pending' : 'saved')}
        </p>
      </CardFooter>
    </Card>
  );
}
