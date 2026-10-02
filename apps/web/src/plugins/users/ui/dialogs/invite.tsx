'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useAction, useFoundation } from '@bitakit/ui';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/** Body of the users.invite dialog; the host renders title and description from the action. */
export default function InviteDialog({ close }: { close(): void }) {
  const t = useTranslations('users.invite');
  const { labels } = useFoundation();
  const [email, setEmail] = useState('');
  const [failed, setFailed] = useState(false);
  const send = useAction('users.send-invite', { email });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!send || send.disabled) return;
    setFailed(false);
    try {
      const result = await send.execute();
      if (result.status === 'completed') close();
    } catch {
      setFailed(true);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={failed || undefined}>
          <FieldLabel htmlFor="users-invite-email">{t('fields.email')}</FieldLabel>
          <Input
            id="users-invite-email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            aria-invalid={failed || undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setFailed(false);
            }}
          />
          {failed && <FieldError>{t('failure')}</FieldError>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={close}>
          {labels.cancel}
        </Button>
        <Button
          type="submit"
          disabled={!send || send.disabled}
          aria-busy={send?.pending || undefined}
        >
          {t('title')}
        </Button>
      </DialogFooter>
    </form>
  );
}
