'use client';
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import type { SettingControl } from '@bitakit/core';
import type { SettingsCatalogField, SettingsCatalogOption } from '@bitakit/ui';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
  Input,
} from '@bitakit/ui/components';
import { sameValue } from '../same.js';
import { iconOf } from './icon.js';
import { RadioGroup, RadioGroupItem } from './ui/radio-group.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { Switch } from './ui/switch.js';
import { Textarea } from './ui/textarea.js';

/**
 * What every setting control receives. Controls render a value and report a new one; values,
 * validation, pending state and persistence stay with the runtime's settings store.
 */
export type SettingControlProps<T = unknown> = {
  field: SettingsCatalogField;
  /** ID of the focusable element, or of the group for radios and cards. */
  id: string;
  value: T;
  onChange(value: T): void;
  disabled: boolean;
  /** IDs of the elements that describe the control: description and feedback. */
  describedBy?: string;
};

const optionIndex = (options: readonly SettingsCatalogOption[], value: unknown) =>
  options.findIndex((option) => sameValue(option.value, value));
const select = (
  options: readonly SettingsCatalogOption[],
  onChange: (value: unknown) => void,
  index: string,
) => {
  const option = options[Number(index)];
  if (option) onChange(option.value);
};

export function SwitchControl({
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: SettingControlProps<boolean>) {
  return (
    <Switch
      id={id}
      checked={value === true}
      disabled={disabled}
      aria-describedby={describedBy}
      onCheckedChange={(checked) => onChange(checked === true)}
    />
  );
}

/** Option values may be any JSON value; the list positions serve as the string values Radix needs. */
export function SelectControl({
  field,
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: SettingControlProps<unknown>) {
  const options = field.options ?? [];
  const selected = optionIndex(options, value);
  return (
    <Select
      value={selected < 0 ? '' : String(selected)}
      disabled={disabled}
      onValueChange={(index) => select(options, onChange, index)}
    >
      <SelectTrigger id={id} aria-describedby={describedBy} className="max-w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option, index) => {
          const Icon = iconOf(option.icon);
          return <SelectItem key={index} value={String(index)}>
            <span className="flex items-center gap-2">{Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}{option.label}</span>
          </SelectItem>;
        })}
      </SelectContent>
    </Select>
  );
}

/** Radios and cards share one radio group; cards place the selection at the trailing edge. */
function Choices({
  field,
  id,
  value,
  onChange,
  disabled,
  describedBy,
  cards,
}: SettingControlProps<unknown> & { cards: boolean }) {
  const options = field.options ?? [];
  const selected = optionIndex(options, value);
  return (
    <RadioGroup
      id={id}
      value={selected < 0 ? '' : String(selected)}
      disabled={disabled}
      aria-label={field.label}
      aria-describedby={describedBy}
      onValueChange={(index) => select(options, onChange, index)}
      className={cards ? 'sm:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]' : undefined}
    >
      {options.map((option, index) => {
        const itemId = `${id}-${index}`;
        const labelId = `${itemId}-label`;
        const descriptionId = option.description ? `${itemId}-description` : undefined;
        const Icon = iconOf(option.icon);
        const control = (
          <RadioGroupItem
            id={itemId}
            value={String(index)}
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
          />
        );
        const content = (
          <FieldContent>
            {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
            {cards ? (
              <FieldTitle id={labelId}>{option.label}</FieldTitle>
            ) : (
              <FieldLabel id={labelId} htmlFor={itemId}>
                {option.label}
              </FieldLabel>
            )}
            {option.description && (
              <FieldDescription id={descriptionId}>{option.description}</FieldDescription>
            )}
          </FieldContent>
        );
        const item = (
          <Field
            orientation="horizontal"
            data-checked={index === selected || undefined}
            data-disabled={disabled || undefined}
          >
            {!cards && control}
            {content}
            {cards && control}
          </Field>
        );
        return cards ? (
          <FieldLabel key={index} htmlFor={itemId}>
            {item}
          </FieldLabel>
        ) : (
          <div key={index}>{item}</div>
        );
      })}
    </RadioGroup>
  );
}
export function RadioControl(props: SettingControlProps<unknown>) {
  return <Choices {...props} cards={false} />;
}
/** Options as selectable cards with their icon and description. */
export function CardsControl(props: SettingControlProps<unknown>) {
  return <Choices {...props} cards />;
}

/**
 * A local edit draft: commits on blur or Enter and restores the confirmed value on Escape. It
 * follows only the confirmed value, so a rejected entry stays visible for correction.
 */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return { draft, setDraft, editing };
}
function TextInput({
  id,
  value,
  onChange,
  disabled,
  describedBy,
  multiline,
}: SettingControlProps<string> & { multiline: boolean }) {
  const confirmed = typeof value === 'string' ? value : '';
  const { draft, setDraft, editing } = useDraft(confirmed);
  const commit = () => {
    editing.current = false;
    if (draft !== confirmed) onChange(draft);
  };
  const shared = {
    id,
    value: draft,
    disabled,
    'aria-describedby': describedBy,
    onFocus: () => {
      editing.current = true;
    },
    onChange: (event: { target: { value: string } }) => {
      editing.current = true;
      setDraft(event.target.value);
    },
    onBlur: commit,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        editing.current = false;
        setDraft(confirmed);
      } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit();
      }
    },
  };
  return multiline ? <Textarea {...shared} rows={3} /> : <Input type="text" {...shared} />;
}
/** Single-line text; commits on blur or Enter. */
export function TextControl(props: SettingControlProps<string>) {
  return <TextInput {...props} multiline={false} />;
}
/** Multi-line text; commits on blur or Ctrl/Cmd+Enter. */
export function TextareaControl(props: SettingControlProps<string>) {
  return <TextInput {...props} multiline />;
}
/** Commits finite numbers on blur or Enter; an empty or unreadable entry restores the value. */
export function NumberControl({
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: SettingControlProps<number>) {
  const confirmed = typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  const { draft, setDraft, editing } = useDraft(confirmed);
  const commit = () => {
    editing.current = false;
    const next = Number(draft.trim());
    if (!draft.trim() || !Number.isFinite(next)) setDraft(confirmed);
    else if (next !== value) onChange(next);
  };
  return (
    <Input
      type="number"
      inputMode="decimal"
      id={id}
      value={draft}
      disabled={disabled}
      aria-describedby={describedBy}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event: { target: { value: string } }) => {
        editing.current = true;
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          editing.current = false;
          setDraft(confirmed);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

const controls: Readonly<Record<SettingControl, ComponentType<SettingControlProps<any>>>> = {
  switch: SwitchControl,
  select: SelectControl,
  radio: RadioControl,
  cards: CardsControl,
  text: TextControl,
  textarea: TextareaControl,
  number: NumberControl,
};
/** Controls whose label names a group rather than one focusable element. */
export const groupControls: ReadonlySet<ComponentType<SettingControlProps<any>>> = new Set([
  RadioControl,
  CardsControl,
]);
/** Controls that keep their own edit draft; they receive confirmed values only. */
export const draftControls: ReadonlySet<ComponentType<SettingControlProps<any>>> = new Set([
  TextControl,
  TextareaControl,
  NumberControl,
]);

/**
 * The control for a field: `spec.control` when declared, otherwise inferred from the value:
 * boolean → switch, options → select, number → number, string → text. Undefined when no
 * standard control fits; a custom settings page renders those.
 */
export function controlFor(
  field: SettingsCatalogField,
): ComponentType<SettingControlProps<any>> | undefined {
  const { spec } = field;
  if (spec.control) return controls[spec.control];
  if (typeof spec.default === 'boolean') return SwitchControl;
  if (field.options?.length) return SelectControl;
  if (typeof spec.default === 'number') return NumberControl;
  if (typeof spec.default === 'string') return TextControl;
  return undefined;
}
