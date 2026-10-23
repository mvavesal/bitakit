'use client';
import { useState } from 'react';
import { useSetting, type SettingsCatalogField } from '@bitakit/ui';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import {
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@bitakit/ui/components';

export function AppearanceField({ field }: { field: SettingsCatalogField }) {
  const setting = useSetting(field.key);
  const [error, setError] = useState('');
  const selected = (field.options ?? []).find((option) => option.value === setting.value);
  return (
    <Field>
      <FieldLabel>{field.label}</FieldLabel>
      {field.description && <FieldDescription>{field.description}</FieldDescription>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-fit" variant="outline" disabled={setting.disabled}>
            {selected?.label ?? String(setting.value)}
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            {(field.options ?? []).map((option) => (
              <DropdownMenuItem
                key={String(option.value)}
                onSelect={() => {
                  setError('');
                  void setting.set(option.value).catch((reason) => setError(String(reason)));
                }}
              >
                {option.label ?? String(option.value)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <FieldDescription role="alert">{error}</FieldDescription>}
    </Field>
  );
}
