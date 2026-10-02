'use client';
import { useTranslation } from '@bitakit/ui';

import { useId, useState } from 'react';
import CalendarIcon from 'reicon-react/icons/Calendar';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import { Button } from './button.js';
import { Input } from './input.js';
import { Field, FieldLabel, FieldGroup } from './field.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const labels = {
    applied: 'Filter active',
    from: 'From',
    to: 'To',
    hint: 'Select a date range.',
    invalidRange: 'The end date must follow the start date.',
    clear: 'Reset',
    apply: 'Apply',
  };
  const translate = useTranslation();
  const t = (key: keyof typeof labels) =>
    translate(`foundationUI.dateRange.${key}`, undefined, labels[key]);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (value) setDraft({ from, to });
        setOpen(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          <CalendarIcon data-icon="inline-start" aria-hidden="true" />
          {label}
          {(from || to) && (
            <span className="size-1.5 rounded-full bg-primary" aria-label={t('applied')} />
          )}
          <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-from`}>{t('from')}</FieldLabel>
            <Input
              id={`${id}-from`}
              type="date"
              value={draft.from}
              max={draft.to || '9999-12-31'}
              onChange={(event) => {
                const next = event.target.value;
                setDraft({ ...draft, from: next });
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-to`}>{t('to')}</FieldLabel>
            <Input
              id={`${id}-to`}
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              max="9999-12-31"
              onChange={(event) => {
                const next = event.target.value;
                setDraft({ ...draft, to: next });
              }}
            />
          </Field>
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
          {draft.from && draft.to && draft.from > draft.to && (
            <p role="alert" className="text-sm text-destructive">
              {t('invalidRange')}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!from && !to && !draft.from && !draft.to}
              onClick={() => {
                setDraft({ from: '', to: '' });
                onChange({ from: '', to: '' });
                setOpen(false);
              }}
            >
              {t('clear')}
            </Button>
            <Button
              size="sm"
              disabled={!!draft.from && !!draft.to && draft.from > draft.to}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {t('apply')}
            </Button>
          </div>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}
