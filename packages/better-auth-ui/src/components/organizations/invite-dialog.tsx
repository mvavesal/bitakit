'use client';
import { useTranslation } from '@bitakit/ui';
import { useState, useSyncExternalStore } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/index.js';
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '../ui/index.js';
import { Button } from '../ui/index.js';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from '../ui/index.js';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import AdminIcon from 'reicon-react/icons/ShieldCheck';
import MemberIcon from 'reicon-react/icons/User';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '../ui/index.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../ui/index.js';
import { InvitationEmailInput } from './invitation-email-input.js';
import type { OrganizationService } from '@bitakit/organizations';
export function InviteDialog({
  service,
  organizationId,
  close,
}: {
  service: OrganizationService;
  organizationId: string | null;
  close(): void;
}) {
  const translateUI = useTranslation();
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const organization = state.organizations.find((item) => item.id === organizationId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [days, setDays] = useState('30');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unavailable = state.activeId !== organizationId || !state.canManage;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || unavailable) return;
    const emails = [
      ...new Set(
        email
          .split(/[;,\n]/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const expiry = Number(days);
    if (
      !emails.length ||
      emails.length > 20 ||
      emails.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) ||
      !Number.isInteger(expiry) ||
      expiry < 1 ||
      expiry > 365
    ) {
      setError(
        translateUI(
          'foundationUI.invite_dialog.enterUpTo20ValidAddressesAndAValidityPeriodOf1',
          undefined,
          'Enter up to 20 valid addresses and a validity period of 1 to 365 days.',
        ),
      );
      return;
    }
    setPending(true);
    setError(null);
    const failed: string[] = [];
    for (const address of emails) {
      try {
        if (service.getSnapshot().activeId !== organizationId) throw new Error('Changed');
        await service.invite(address, role, expiry);
      } catch {
        failed.push(address);
      }
    }
    setPending(false);
    if (failed.length) {
      setEmail(failed.join(',') + ',');
      setError(
        translateUI(
          'foundationUI.invite_dialog.partialSuccess',
          { count: emails.length - failed.length, total: emails.length },
          `Created ${emails.length - failed.length} of ${emails.length} invitations. Only failed addresses remain for retry.`,
        ),
      );
    } else close();
  }
  return (
    <form onSubmit={submit} className="min-w-0">
      <FieldGroup className="gap-5">
        {organization && (
          <>
            <Item size="sm" variant="muted">
              <ItemMedia>
                <Avatar>
                  {organization.logo && <AvatarImage src={organization.logo} alt="" />}
                  <AvatarFallback>{organization.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemDescription>
                  {translateUI(
                    'foundationUI.invite_dialog.invitationTo',
                    undefined,
                    'Invitation to',
                  )}
                </ItemDescription>
                <ItemTitle className="break-all">{organization.name}</ItemTitle>
              </ItemContent>
            </Item>
          </>
        )}
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="invite-email">
            {translateUI('foundationUI.invite_dialog.email', undefined, 'Email')}
          </FieldLabel>
          <InvitationEmailInput
            value={email}
            onChange={setEmail}
            onBlur={() => {}}
            invalid={!!error}
            disabled={pending || unavailable}
          />
          <FieldDescription id="invite-email-hint">
            {translateUI(
              'foundationUI.invite_dialog.upTo20AddressesSeparatedByCommasSemicolonsOrNewLines',
              undefined,
              'Up to 20 addresses, separated by commas, semicolons or new lines.',
            )}
          </FieldDescription>
        </Field>
        <FieldGroup className="grid grid-cols-2 gap-4 sm:flex sm:flex-row sm:justify-between sm:gap-6">
          <Field className="min-w-0 gap-2 sm:w-40">
            <FieldLabel id="invite-role-label">
              {translateUI('foundationUI.invite_dialog.role', undefined, 'Role')}
            </FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || unavailable}
                  className="w-full justify-between"
                  aria-labelledby="invite-role-label invite-role-value"
                >
                  {role === 'admin' ? (
                    <AdminIcon aria-hidden="true" data-icon="inline-start" />
                  ) : (
                    <MemberIcon aria-hidden="true" data-icon="inline-start" />
                  )}
                  <span id="invite-role-value" className="flex-1 text-left">
                    {role === 'admin'
                      ? translateUI('foundationUI.invite_dialog.admin', undefined, 'Admin')
                      : translateUI('foundationUI.invite_dialog.member', undefined, 'Member')}
                  </span>
                  <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup
                  value={role}
                  onValueChange={(value) => setRole(value === 'admin' ? 'admin' : 'member')}
                >
                  <DropdownMenuRadioItem value="member">
                    <MemberIcon aria-hidden="true" />
                    {translateUI('foundationUI.invite_dialog.member', undefined, 'Member')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="admin">
                    <AdminIcon aria-hidden="true" />
                    {translateUI('foundationUI.invite_dialog.admin', undefined, 'Admin')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>
          <Field className="min-w-0 gap-2 sm:w-40">
            <FieldLabel htmlFor="invite-expiry">
              {translateUI('foundationUI.invite_dialog.validity', undefined, 'Validity')}
            </FieldLabel>
            <InputGroup className="max-w-44 overflow-hidden">
              <InputGroupInput
                id="invite-expiry"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                disabled={pending || unavailable || !service.capabilities.customInvitationExpiry}
              />
              <InputGroupAddon
                align="inline-end"
                className="self-stretch border-l-(length:--border-width) border-input bg-muted px-3"
              >
                <InputGroupText>
                  {translateUI('foundationUI.invite_dialog.days', undefined, 'Days')}
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
        {unavailable && (
          <p role="alert">
            {translateUI(
              'foundationUI.invite_dialog.theWorkspaceChangedOrPermissionIsMissingOpenTheInvitationAgain',
              undefined,
              'The workspace changed or permission is missing. Open the invitation again.',
            )}
          </p>
        )}
        {error && (
          <p role="alert" id="invite-email-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>
            {translateUI('foundationUI.invite_dialog.cancel', undefined, 'Cancel')}
          </Button>
          <Button type="submit" disabled={pending || unavailable || !email.trim()}>
            {pending
              ? translateUI('foundationUI.invite_dialog.sending', undefined, 'Sending …')
              : translateUI(
                  'foundationUI.invite_dialog.sendInvitations',
                  undefined,
                  'Send invitations',
                )}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
