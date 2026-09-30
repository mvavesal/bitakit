'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';

export function InvitationEmailInput({
  value,
  onChange,
  onBlur,
  invalid,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('Organizations');
  const anchor = useComboboxAnchor();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const parts = value.split(/[;,\n]/);
  const draft = parts.pop() ?? '';
  const selected = [...new Set(parts.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const candidate = draft.trim().toLowerCase();
  const valid = z.email().safeParse(candidate).success;
  const options = valid && !selected.includes(candidate) ? [...selected, candidate] : selected;
  function update(emails: string[]) {
    onChange(emails.length ? [...new Set(emails)].join(',') + ',' : '');
  }
  return (
    <Combobox
      multiple
      items={options}
      value={selected}
      inputValue={draft}
      disabled={disabled}
      onValueChange={update}
      onInputValueChange={(text, details) => {
        if (details.reason === 'input-change') {
          setShowSuggestions(true);
          onChange([...selected, text].join(','));
        }
      }}
      open={showSuggestions && !!candidate && valid && !selected.includes(candidate)}
      onOpenChange={setShowSuggestions}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {selected.map((email) => (
            <ComboboxChip
              key={email}
              aria-label={email}
              removeLabel={t('removeEmail', { email })}
              className="max-w-full"
            >
              <Avatar className="size-4">
                <AvatarFallback>{email.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate">{email}</span>
            </ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxChipsInput
          id="invite-email"
          aria-label={t('email')}
          placeholder={t('addEmails')}
          aria-invalid={invalid}
          aria-describedby="invite-email-hint invite-email-error"
          onBlur={onBlur}
          autoComplete="off"
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ',') && valid) {
              event.preventDefault();
              update([...selected, candidate]);
            }
          }}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxList>
          {(email: string) => (
            <ComboboxItem key={email} value={email}>
              <Avatar className="size-6">
                <AvatarFallback>{email.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              {t('addEmail', { email })}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
