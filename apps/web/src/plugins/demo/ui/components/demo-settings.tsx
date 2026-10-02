'use client';
import { useTranslations } from 'next-intl';
import { Action } from '@bitakit/ui';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';

export function DemoSettings() {
  const t = useTranslations('demo');
  return (
    <Field orientation="horizontal">
      <Action id="demo.enabled" kind="toggle">
        <Checkbox id="demo-enabled" />
      </Action>
      <div className="grid gap-2">
        <FieldLabel htmlFor="demo-enabled">{t('enabled.title')}</FieldLabel>
        <FieldDescription>{t('settings.description')}</FieldDescription>
      </div>
    </Field>
  );
}
