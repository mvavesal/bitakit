'use client';
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import type { SettingControl } from '@bitakit/core';
import type { SettingsCatalogField, SettingsCatalogOption } from '@bitakit/ui';
import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  RadioGroup,
  RadioGroupItem,
} from '@bitakit/ui/components';
import PlusIcon from 'reicon-react/icons/Plus';
import TrashIcon from 'reicon-react/icons/Trash';
import { sameValue } from '../same.js';
import { iconOf } from './icon.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { Switch } from './ui/switch.js';
import { Textarea } from './ui/textarea.js';
import { useMessages } from './use-messages.js';

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
          return (
            <SelectItem key={index} value={String(index)}>
              <span className="flex items-center gap-2">
                {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                {option.label}
              </span>
            </SelectItem>
          );
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

/** Several of the options, one checkbox each; the value lists the chosen ones in option order. */
export function CheckboxesControl({
  field,
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: SettingControlProps<unknown>) {
  const options = field.options ?? [];
  const chosen = Array.isArray(value) ? value : [];
  const has = (option: SettingsCatalogOption) =>
    chosen.some((entry) => sameValue(entry, option.value));
  return (
    <div
      id={id}
      role="group"
      aria-label={field.label}
      aria-describedby={describedBy}
      className="flex flex-col gap-3"
    >
      {options.map((option, index) => (
        <Field key={index} orientation="horizontal" data-disabled={disabled || undefined}>
          <Checkbox
            id={`${id}-${index}`}
            checked={has(option)}
            disabled={disabled}
            onCheckedChange={(on) =>
              onChange(
                options
                  .filter((other) => (other === option ? on === true : has(other)))
                  .map((other) => other.value),
              )
            }
          />
          <FieldLabel htmlFor={`${id}-${index}`} className="font-normal">
            {option.label}
          </FieldLabel>
        </Field>
      ))}
    </div>
  );
}

/** A list of short texts: each with a remove button, and a text box that adds one on Enter. */
export function ListControl({
  field,
  id,
  value,
  onChange,
  disabled,
  describedBy,
}: SettingControlProps<unknown>) {
  const messages = useMessages();
  const entries = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const [draft, setDraft] = useState('');
  const next = draft.trim();
  const add = () => {
    if (!next || entries.includes(next)) return;
    onChange([...entries, next]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      {entries.length > 0 && (
        <ul aria-label={field.label} className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry}>
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{entry}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={messages('listRemove', { value: entry })}
                    onClick={() => onChange(entries.filter((other) => other !== entry))}
                  >
                    <TrashIcon aria-hidden="true" />
                  </Button>
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event: { target: { value: string } }) => setDraft(event.target.value)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            add();
          }}
        />
        <Button type="button" variant="outline" disabled={disabled || !next} onClick={add}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {messages('listAdd')}
        </Button>
      </div>
    </div>
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
  list: ListControl,
  checkboxes: CheckboxesControl,
};
/** Controls whose label names a group rather than one focusable element. */
export const groupControls: ReadonlySet<ComponentType<SettingControlProps<any>>> = new Set([
  RadioControl,
  CardsControl,
  CheckboxesControl,
]);
/** Controls that keep their own edit draft; they receive confirmed values only. */
export const draftControls: ReadonlySet<ComponentType<SettingControlProps<any>>> = new Set([
  TextControl,
  TextareaControl,
  NumberControl,
]);

/**
 * The control for a field: `spec.control` when declared, otherwise inferred from the value:
 * boolean → switch, a list with options → checkboxes, a list → list, options → select, number
 * → number, string → text. Undefined when no standard control fits; a custom settings page
 * renders those.
 */
export function controlFor(
  field: SettingsCatalogField,
): ComponentType<SettingControlProps<any>> | undefined {
  const { spec } = field;
  if (spec.control) return controls[spec.control];
  if (typeof spec.default === 'boolean') return SwitchControl;
  if (Array.isArray(spec.default)) return field.options?.length ? CheckboxesControl : ListControl;
  if (field.options?.length) return SelectControl;
  if (typeof spec.default === 'number') return NumberControl;
  if (typeof spec.default === 'string') return TextControl;
  return undefined;
}
