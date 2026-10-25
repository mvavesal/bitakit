'use client';
import { useEffect, useId, useRef } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { useService } from '@bitakit/ui';
import { ActionShortcutLabel, useAction } from '@bitakit/ui/actions';
import { Field, FieldLabel } from '@bitakit/ui/components';
import SearchIcon from 'reicon-react/icons/Search';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupClearButton,
  InputGroupInput,
} from './ui/input-group.js';
import { pluginId } from '../id.js';
import { settingsSearch, type SettingsSearch } from '../search-target.js';

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
  /** The settings search: its shortcut focuses this field, and the keys show while it is empty. */
  shortcut?: boolean;
};
/** A search input with a clear button. */
export function SearchField({
  label,
  placeholder,
  clearLabel,
  value,
  onValueChange,
  showLabel = false,
  shortcut = false,
}: SearchFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const search = useService(settingsSearch) as SettingsSearch | undefined;
  const editable = !!onValueChange;
  useEffect(() => {
    if (!shortcut || !editable || !search) return;
    return search.show(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, [shortcut, editable, search]);
  const keys = useAction(`${pluginId}.search`)?.shortcut?.keys;
  const field = (
    <InputGroup role="search">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        ref={input}
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
      {value && onValueChange ? (
        <InputGroupAddon align="inline-end">
          <InputGroupClearButton aria-label={clearLabel} onClear={() => void onValueChange(null)} />
        </InputGroupAddon>
      ) : (
        shortcut &&
        keys && (
          // Touch screens without a keyboard do not show the hint.
          <InputGroupAddon align="inline-end" className="pointer-coarse:hidden">
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1 font-sans text-xs text-muted-foreground">
              <ActionShortcutLabel keys={keys} />
            </kbd>
          </InputGroupAddon>
        )
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
