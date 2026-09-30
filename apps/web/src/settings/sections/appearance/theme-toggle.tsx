'use client';
import { useTranslations } from 'next-intl';

import MoonIcon from 'reicon-react/icons/Moon';
import SunIcon from 'reicon-react/icons/Sun';
import { useTheme } from '@/hooks/use-theme';
import { ActionButton } from '@bitakit/ui/actions';
import { useSetting } from '@bitakit/app-preferences';
import { themeSetting } from '@/settings/definitions';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const t = useTranslations('Appearance');
  const { resolved } = useTheme();
  const { error } = useSetting(themeSetting);
  return (
    <span className="inline-flex items-center gap-2">
      <ActionButton
        action="theme.set"
        input={resolved === 'dark' ? 'light' : 'dark'}
        as={Button}
        variant="ghost"
        size="icon"
        aria-label={t('toggle')}
        title={t('toggle')}
      >
        <MoonIcon aria-hidden="true" className="dark:hidden" />
        <SunIcon aria-hidden="true" className="hidden dark:block" />
      </ActionButton>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {t('error')}
        </span>
      )}
    </span>
  );
}
