'use client';
import { useTranslations } from 'next-intl';
import { ActionCheckbox } from '@bitakit/ui/actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';

export function DemoSettings() {
  const t = useTranslations('demo');
  return (
    <Field orientation="horizontal">
      <ActionCheckbox action="demo.enabled" as={Checkbox} id="demo-enabled" />
      <div className="grid gap-2">
        <FieldLabel htmlFor="demo-enabled">{t('enabled.title')}</FieldLabel>
        <FieldDescription>{t('settings.description')}</FieldDescription>
      </div>
    </Field>
  );
}
