'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SettingControlProps, TypeControlProps } from '../renderers/types.js';
import { Checkbox } from './ui/checkbox.js';
import { Switch } from './ui/switch.js';
import { RadioGroup, RadioGroupItem } from './ui/radio-group.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select.js';
import { Input } from './ui/input.js';
import { Textarea } from './ui/textarea.js';
import { Field, FieldLabel, FieldContent, FieldTitle, FieldDescription } from './ui/field.js';

function described(props: SettingControlProps) {
  return {
    'aria-labelledby': props.labelId,
    'aria-describedby': props.describedBy,
    'aria-invalid': props.error ? true : undefined,
    'aria-busy': props.pending || undefined,
  } as const;
}
export function CheckboxControl(props: TypeControlProps<'boolean'>) {
  return (
    <Checkbox
      id={props.id}
      checked={props.value}
      disabled={props.disabled}
      onCheckedChange={(value) => void props.setValue(value === true)}
      {...described(props)}
    />
  );
}
export function SwitchControl(props: TypeControlProps<'boolean'>) {
  return (
    <Switch
      id={props.id}
      checked={props.value}
      disabled={props.disabled}
      onCheckedChange={(value) => void props.setValue(value)}
      {...described(props)}
    />
  );
}
export function SelectControl(props: TypeControlProps<'choice'>) {
  return (
    <Select
      value={props.value}
      disabled={props.disabled}
      onValueChange={(value) => void props.setValue(value)}
    >
      <SelectTrigger id={props.id} {...described(props)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {props.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Standard Field cards place selection at the trailing edge; plain choices keep it leading. */
function Choices({
  props,
  cards,
  multiple = false,
}: {
  props: TypeControlProps<'choice'> | TypeControlProps<'multi-choice'>;
  cards: boolean;
  multiple?: boolean;
}) {
  const columns = props.presentation.columns;
  const horizontal = props.presentation.orientation === 'horizontal';
  const className = columns
    ? 'grid gap-3 sm:[grid-template-columns:var(--preferences-columns)]'
    : horizontal
      ? 'flex flex-wrap gap-3'
      : 'grid gap-3';
  const style = columns
    ? ({ '--preferences-columns': `repeat(${columns}, minmax(0, 1fr))` } as CSSProperties)
    : undefined;
  const items = props.options.map((option, index) => {
    const id = `${props.id}-${index}`;
    const checked = multiple
      ? (props.value as readonly string[]).includes(option.value)
      : props.value === option.value;
    const descriptionId = option.description ? `${id}-description` : undefined;
    const control = multiple ? (
      <Checkbox
        id={id}
        checked={checked}
        disabled={props.disabled}
        aria-describedby={descriptionId}
        aria-labelledby={`${id}-label`}
        onCheckedChange={(value) => {
          const values = props.value as readonly string[];
          void (props as TypeControlProps<'multi-choice'>).setValue(
            value === true
              ? [...values, option.value]
              : values.filter((item) => item !== option.value),
          );
        }}
      />
    ) : (
      <RadioGroupItem
        id={id}
        value={option.value}
        aria-describedby={descriptionId}
        aria-labelledby={`${id}-label`}
      />
    );
    const content = (
      <FieldContent>
        {option.icon && <option.icon className="size-5 shrink-0" aria-hidden />}
        {cards ? (
          <FieldTitle id={`${id}-label`}>{option.label}</FieldTitle>
        ) : (
          <FieldLabel id={`${id}-label`} htmlFor={id}>
            {option.label}
          </FieldLabel>
        )}
        {option.description && (
          <FieldDescription id={descriptionId}>{option.description}</FieldDescription>
        )}
      </FieldContent>
    );
    const field = (
      <Field
        orientation="horizontal"
        data-checked={checked ? '' : undefined}
        data-disabled={props.disabled || undefined}
      >
        {!cards && control}
        {content}
        {cards && control}
      </Field>
    );
    return cards ? (
      <FieldLabel
        key={option.value}
        htmlFor={id}
        className={horizontal && !columns ? 'flex-1' : undefined}
      >
        {field}
      </FieldLabel>
    ) : (
      <div key={option.value}>{field}</div>
    );
  });
  const shared = { id: props.id, className, style, ...described(props) };
  return multiple ? (
    <div role="group" {...shared}>
      {items}
    </div>
  ) : (
    <RadioGroup
      {...shared}
      value={props.value as string}
      disabled={props.disabled}
      orientation={horizontal ? 'horizontal' : 'vertical'}
      onValueChange={(value) => void (props as TypeControlProps<'choice'>).setValue(value)}
    >
      {items}
    </RadioGroup>
  );
}
export function RadioControl(props: TypeControlProps<'choice'>) {
  return <Choices props={props} cards={false} />;
}
export function CardsControl(props: TypeControlProps<'choice'>) {
  return <Choices props={props} cards />;
}
export function MultiChoiceControl(props: TypeControlProps<'multi-choice'>) {
  return <Choices props={props} multiple cards={false} />;
}
export function MultiCardsControl(props: TypeControlProps<'multi-choice'>) {
  return <Choices props={props} multiple cards />;
}

/**
 * Local edit draft; commits on blur or Enter and restores the confirmed value on Escape. It follows
 * the confirmed value only, so a rejected input stays visible for correction.
 */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return { draft, setDraft, editing };
}
function TextInput({ props, multiline }: { props: TypeControlProps<'text'>; multiline: boolean }) {
  const { draft, setDraft, editing } = useDraft(props.confirmedValue);
  const commit = () => {
    editing.current = false;
    if (draft !== props.confirmedValue) void props.setValue(draft);
  };
  const shared = {
    id: props.id,
    value: draft,
    disabled: props.disabled,
    onFocus: () => {
      editing.current = true;
    },
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event: {
      key: string;
      metaKey?: boolean;
      ctrlKey?: boolean;
      preventDefault(): void;
    }) => {
      if (event.key === 'Escape') {
        editing.current = false;
        setDraft(props.confirmedValue);
      } else if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit();
      }
    },
    ...described(props),
  };
  if (multiline) return <Textarea {...shared} rows={3} />;
  return <Input type="text" {...shared} />;
}
export function TextControl(props: TypeControlProps<'text'>) {
  return <TextInput props={props} multiline={false} />;
}
export function TextareaControl(props: TypeControlProps<'text'>) {
  return <TextInput props={props} multiline />;
}
export function NumberControl(props: TypeControlProps<'number'>) {
  const { draft, setDraft, editing } = useDraft(String(props.confirmedValue));
  const commit = () => {
    editing.current = false;
    const next = draft.trim() ? Number(draft) : Number.NaN;
    if (next !== props.confirmedValue) void props.setValue(next);
  };
  return (
    <Input
      type="number"
      inputMode="decimal"
      id={props.id}
      value={draft}
      min={props.presentation.min}
      max={props.presentation.max}
      step={props.presentation.step}
      disabled={props.disabled}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event: { target: { value: string } }) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event: { key: string; preventDefault(): void }) => {
        if (event.key === 'Escape') {
          editing.current = false;
          setDraft(String(props.confirmedValue));
        } else if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
      {...described(props)}
    />
  );
}
