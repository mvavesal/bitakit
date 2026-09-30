'use client';

import { useTranslations } from 'next-intl';

import RefreshIcon from 'reicon-react/icons/Refresh';
import { ThemeToggle } from '@/settings/sections/appearance/theme-toggle';
import { useTheme } from '@/hooks/use-theme';
import { SettingsField, useSetting } from '@bitakit/app-preferences';
import { themeSetting } from '../../definitions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { FieldSet, FieldLegend } from '@/components/ui/field';

export function AppearanceSettings() {
  const t = useTranslations('Appearance');
  const { preference, resolved, ready, sessionOnly } = useTheme();
  const setting = useSetting(themeSetting);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('color')}</h2>
        </CardTitle>
        <CardDescription>{t('intro')}</CardDescription>
      </CardHeader>
      <CardContent>
        {
          <FieldSet>
            <FieldLegend className="sr-only">{t('color')}</FieldLegend>
            <SettingsField setting={themeSetting} />
            <p role="status" className="text-sm text-muted-foreground">
              {setting.pending
                ? t('pending')
                : !ready
                  ? t('loading')
                  : preference === 'system'
                    ? t('following', { theme: resolved })
                    : t('selected', { theme: t(preference) })}
            </p>
          </FieldSet>
        }
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-4">
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {t(sessionOnly ? 'sessionOnly' : 'saved')}
        </p>
        <ThemeToggle />
        <Button
          variant="outline"
          disabled={setting.disabled || setting.value === 'system'}
          onClick={() => {
            void setting.setValue('system').catch(() => {});
          }}
        >
          <RefreshIcon data-icon="inline-start" aria-hidden="true" />
          {t('restore')}
        </Button>
      </CardFooter>
    </Card>
  );
}
