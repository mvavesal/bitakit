'use client';
import { useSetting, useTranslation } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';

export const order = -10;

export default function ThemeToggle() {
  const mode = useSetting('shell.mode');
  const t = useTranslation();
  return (
    <Button
      variant="outline"
      size="icon"
      disabled={mode.disabled}
      onClick={() => {
        const dark =
          mode.value === 'dark' ||
          (mode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        void mode.set(dark ? 'light' : 'dark');
      }}
    >
      <SunIcon aria-hidden="true" className="hidden dark:block" />
      <MoonIcon aria-hidden="true" className="dark:hidden" />
      <span className="sr-only hidden dark:inline">{t('theme-toggle.light')}</span>
      <span className="sr-only dark:hidden">{t('theme-toggle.dark')}</span>
    </Button>
  );
}
