'use client';

import { useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

const colors = { violet: '#713df5', blue: '#2563eb', green: '#15803d', rose: '#be185d' };

function foreground(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179
    ? '#000000'
    : '#ffffff';
}

export function ControlPreview() {
  const t = useTranslations('ControlPreview');
  const [color, setColor] = useState<string | null>(null);
  const previewStyle = color
    ? ({ '--primary': color, '--primary-foreground': foreground(color) } as CSSProperties)
    : undefined;

  return (
    <Card id="control-preview" style={previewStyle}>
      <CardHeader>
        <CardTitle>
          <h2>{t('title')}</h2>
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="preview-primary">{t('primaryColor')}</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="preview-primary"
              type="color"
              value={color ?? '#171717'}
              onInput={(event) => setColor(event.currentTarget.value)}
              onChange={(event) => setColor(event.target.value)}
              className="w-16 cursor-pointer p-1"
            />
            <output className="text-sm text-muted-foreground" htmlFor="preview-primary">
              {color ?? t('themeDefault')}
            </output>
            {Object.entries(colors).map(([name, value]) => (
              <Button
                key={name}
                variant="outline"
                size="sm"
                aria-pressed={color === value}
                onClick={() => setColor(value)}
              >
                {t(name)}
              </Button>
            ))}
            <Button variant="ghost" size="sm" disabled={!color} onClick={() => setColor(null)}>
              {t('reset')}
            </Button>
          </div>
        </Field>
        <div className="grid gap-6 sm:grid-cols-3">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-sm font-medium">{t('checkboxes')}</legend>
            <Field orientation="horizontal">
              <Checkbox id="preview-check" />
              <FieldLabel htmlFor="preview-check">{t('emailUpdates')}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="preview-checked" defaultChecked />
              <FieldLabel htmlFor="preview-checked">{t('productUpdates')}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="preview-disabled" defaultChecked disabled />
              <FieldLabel htmlFor="preview-disabled">{t('disabled')}</FieldLabel>
            </Field>
          </fieldset>
          <fieldset>
            <legend className="mb-4 text-sm font-medium">{t('radios')}</legend>
            <RadioGroup defaultValue="first" aria-label={t('radios')}>
              <Field orientation="horizontal">
                <RadioGroupItem id="preview-radio-first" value="first" />
                <FieldLabel htmlFor="preview-radio-first">{t('firstOption')}</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem id="preview-radio-second" value="second" />
                <FieldLabel htmlFor="preview-radio-second">{t('secondOption')}</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem id="preview-radio-disabled" value="disabled" disabled />
                <FieldLabel htmlFor="preview-radio-disabled">{t('disabled')}</FieldLabel>
              </Field>
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-sm font-medium">{t('switches')}</legend>
            <Field orientation="horizontal">
              <Switch id="preview-switch" />
              <FieldLabel htmlFor="preview-switch">{t('notifications')}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch id="preview-switch-on" defaultChecked />
              <FieldLabel htmlFor="preview-switch-on">{t('autoSave')}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch id="preview-switch-disabled" defaultChecked disabled />
              <FieldLabel htmlFor="preview-switch-disabled">{t('disabled')}</FieldLabel>
            </Field>
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button>{t('primary')}</Button>
          <Button variant="secondary">{t('secondary')}</Button>
          <Button variant="outline">{t('outline')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
