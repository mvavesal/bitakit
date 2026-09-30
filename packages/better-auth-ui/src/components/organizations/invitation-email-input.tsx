'use client';
import { useTranslation } from '@bitakit/ui';

import { useState } from 'react';
import {  Avatar, AvatarFallback  } from '../ui/index.js';
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
 } from '../ui/index.js';

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
  const translateUI = useTranslation();
  const anchor = useComboboxAnchor();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const parts = value.split(/[;,\n]/);
  const draft = parts.pop() ?? '';
  const selected = [...new Set(parts.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const candidate = draft.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate);
  const options = valid && !selected.includes(candidate) ? [...selected, candidate] : selected;
  function update(emails: string[]) {
    onChange(emails.length ? [...new Set(emails)].join(',') + ',' : '');
  }
  return (
    <Combobox
      multiple
      modal={false}
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
              removeLabel={`Entfernen: ${email}`}
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
          aria-label={translateUI("foundationUI.invitation_email_input.email", undefined, "E-Mail")}
          placeholder={translateUI("foundationUI.invitation_email_input.addEmailAddresses", undefined, "E-Mail-Adressen hinzufügen")}
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
              {email} {translateUI("foundationUI.invitation_email_input.add", undefined, "hinzufügen")}</ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
