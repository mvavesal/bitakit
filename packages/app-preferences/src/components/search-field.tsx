'use client';
import { useId } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { Field, FieldLabel } from '@bitakit/ui/components';
import SearchIcon from 'reicon-react/icons/Search';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupClearButton,
  InputGroupInput,
} from './ui/input-group.js';

const query = parseAsString.withDefault('').withOptions({ history: 'replace' });
/** The settings search, kept in the `q` query parameter. Needs a nuqs adapter and Suspense. */
export function useSettingsQuery() {
  return useQueryState('q', query);
}
const pluginSearch = parseAsString.withDefault('').withOptions({ history: 'replace' });
/** The plugin list search, kept in the `pluginSearch` query parameter. */
export function usePluginSearch() {
  return useQueryState('pluginSearch', pluginSearch);
}

export type SearchFieldProps = {
  label: string;
  placeholder: string;
  clearLabel: string;
  value: string;
  /** Omitted while the query state is unavailable, for example during a Suspense fallback. */
  onValueChange?: (value: string | null) => void;
  /** Show the label above the field instead of naming the input only for assistive technology. */
  showLabel?: boolean;
};
/** A search input with a clear button. */
export function SearchField({
  label,
  placeholder,
  clearLabel,
  value,
  onValueChange,
  showLabel = false,
}: SearchFieldProps) {
  const id = useId();
  const field = (
    <InputGroup role="search">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="text"
        aria-label={showLabel ? undefined : label}
        placeholder={placeholder}
        value={value}
        disabled={!onValueChange}
        onChange={(event) => {
          void onValueChange?.(event.target.value);
        }}
      />
      {value && onValueChange && (
        <InputGroupAddon align="inline-end">
          <InputGroupClearButton aria-label={clearLabel} onClear={() => void onValueChange(null)} />
        </InputGroupAddon>
      )}
    </InputGroup>
  );
  if (!showLabel) return field;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {field}
    </Field>
  );
}
