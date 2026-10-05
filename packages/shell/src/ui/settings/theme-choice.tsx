'use client';
import { useId } from 'react';
import { useTranslation } from '@bitakit/ui';
import { Button, Field, FieldLabel, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@bitakit/ui/components';
import ChevronDown from 'reicon-react/icons/ChevronDown';

export function ThemeChoice({ label, value, choices, onChange }: {
  label: string; value: string; choices: readonly { value: string; label: string }[]; onChange(value: string): void;
}) {
  const id = useId();
  const t = useTranslation();
  const known = choices.some((option) => option.value === value);
  const inherited = t('shell.ui.themes.inherited', undefined, 'Theme default');
  const selected = choices.find((option) => option.value === value)?.label
    ?? (value ? `${t('shell.ui.themes.customValue', undefined, 'Custom')} · ${value}` : inherited);
  return <Field><FieldLabel id={`${id}-label`}>{label}</FieldLabel>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" aria-labelledby={`${id}-label ${id}-value`}>
          <span id={`${id}-value`}>{selected}</span><ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value || 'inherit'} onValueChange={(next) => onChange(next === 'inherit' ? '' : next)}>
          <DropdownMenuRadioItem value="inherit">{inherited}</DropdownMenuRadioItem>
          {!known && value && <DropdownMenuRadioItem value={value}>{selected}</DropdownMenuRadioItem>}
          {choices.map((choice) => <DropdownMenuRadioItem key={choice.value} value={choice.value}>{choice.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </Field>;
}
