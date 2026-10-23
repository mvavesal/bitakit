'use client';
import { useId, type CSSProperties } from 'react';
import { flatButtonTokens } from './button-finish.js';
import { themeTokens, defaultTheme } from '../../themes.js';
import { useTranslation } from '@bitakit/ui';
import {
  Button,
  Field,
  FieldLabel,
  FieldContent,
  FieldTitle,
  RadioGroup,
  RadioGroupItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@bitakit/ui/components';
import ChevronDown from 'reicon-react/icons/ChevronDown';

type ChoicePreview = 'radius' | 'shadow' | 'font' | 'button';

function ChoiceSample({
  kind,
  value,
  compact = false,
}: {
  kind: ChoicePreview;
  value: string;
  compact?: boolean;
}) {
  if (kind === 'button') {
    const tokens = themeTokens(
      {
        ...defaultTheme,
        shared:
          value === 'flat'
            ? flatButtonTokens
            : Object.fromEntries(Object.keys(flatButtonTokens).map((key) => [key, 'initial'])),
      },
      'light',
    );
    const style = Object.fromEntries(
      Object.entries(tokens).map(([key, token]) => [`--${key}`, token]),
    ) as CSSProperties;
    return (
      <span aria-hidden="true" className="pointer-events-none" style={style}>
        <Button asChild size="sm" style={{ color: 'var(--primary-foreground)' }}>
          <span>Aa</span>
        </Button>
      </span>
    );
  }
  if (kind === 'font')
    return (
      <span
        aria-hidden="true"
        className="shrink-0 text-base"
        style={{ fontFamily: value || 'var(--font-sans)' }}
      >
        Aa 123
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={
        compact
          ? 'flex h-6 w-8 shrink-0 items-center justify-center'
          : 'flex h-12 w-20 shrink-0 items-center justify-center'
      }
    >
      {kind === 'radius' ? (
        <span
          className={
            compact
              ? 'h-5 w-6 border-s border-t border-foreground/50'
              : 'h-8 w-12 border-s border-t border-foreground/50'
          }
          style={{ borderTopLeftRadius: value || 'var(--radius)' }}
        />
      ) : (
        <span
          className={
            compact
              ? 'h-4 w-6 rounded-card border border-border bg-card'
              : 'h-6 w-10 rounded-card border border-border bg-card'
          }
          style={{ boxShadow: value || 'var(--theme-shadow-surface, var(--shadow-xs))' }}
        />
      )}
    </span>
  );
}

export function ThemeChoice({
  label,
  value,
  choices,
  preview,
  onChange,
}: {
  label: string;
  value: string;
  choices: readonly { value: string; label: string }[];
  preview?: ChoicePreview;
  onChange(value: string): void;
}) {
  const id = useId();
  const t = useTranslation();
  const known = choices.some((option) => option.value === value);
  const inherited = t('shell.ui.themes.inherited', undefined, 'Theme default');
  const selected =
    choices.find((option) => option.value === value)?.label ??
    (value ? t('shell.ui.themes.customValue', undefined, 'Custom') : inherited);
  if (preview && preview !== 'font') {
    const options = [
      ...(preview === 'button' ? [] : [{ value: '', label: inherited }]),
      ...(!known && value ? [{ value, label: selected }] : []),
      ...choices,
    ];
    return (
      <Field>
        <FieldLabel id={`${id}-label`}>{label}</FieldLabel>
        <RadioGroup
          aria-labelledby={`${id}-label`}
          value={value || 'inherit'}
          onValueChange={(next) => onChange(next === 'inherit' ? '' : next)}
          className="sm:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]"
        >
          {options.map((option, index) => {
            const itemId = `${id}-${index}`;
            const labelId = `${itemId}-label`;
            return (
              <FieldLabel key={option.value || 'inherit'} htmlFor={itemId}>
                <Field orientation="horizontal" data-checked={value === option.value || undefined}>
                  <FieldContent>
                    <ChoiceSample kind={preview} value={option.value} />
                    <FieldTitle id={labelId}>{option.label}</FieldTitle>
                  </FieldContent>
                  <RadioGroupItem
                    id={itemId}
                    value={option.value || 'inherit'}
                    aria-labelledby={labelId}
                  />
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>
      </Field>
    );
  }
  return (
    <Field>
      <FieldLabel id={`${id}-label`}>{label}</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            aria-labelledby={`${id}-label ${id}-value`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              {preview && <ChoiceSample kind={preview} value={value} compact />}
              <span className="truncate" id={`${id}-value`}>
                {selected}
              </span>
            </span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuRadioGroup
            value={value || 'inherit'}
            onValueChange={(next) => onChange(next === 'inherit' ? '' : next)}
          >
            <DropdownMenuRadioItem value="inherit">
              <span className="flex w-full items-center justify-between gap-4">
                {inherited}
                {preview && <ChoiceSample kind={preview} value="" />}
              </span>
            </DropdownMenuRadioItem>
            {!known && value && (
              <DropdownMenuRadioItem value={value}>{selected}</DropdownMenuRadioItem>
            )}
            {choices.map((choice) => (
              <DropdownMenuRadioItem key={choice.value} value={choice.value}>
                <span className="flex w-full items-center justify-between gap-4">
                  {choice.label}
                  {preview && <ChoiceSample kind={preview} value={choice.value} />}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Field>
  );
}
