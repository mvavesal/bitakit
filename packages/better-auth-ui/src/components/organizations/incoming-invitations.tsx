'use client';
import { useAuth } from '@better-auth-ui/react';
import { useTranslation } from '@bitakit/ui';
import { useSyncExternalStore } from 'react';
import { cn } from 'cn';
import { parseAsString, useQueryState } from 'nuqs';
import { useFoundation } from '@bitakit/ui';
import { getService } from '@bitakit/core';
import { PageHeader } from '../ui/index.js';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../ui/index.js';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupClearButton,
} from '../ui/index.js';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/index.js';
import { Badge } from '../ui/index.js';
import SearchIcon from 'reicon-react/icons/Search';
import { MemberRoleIcon, MemberStatusIcon } from './people-icons.js';
import { organizationService } from '@bitakit/organizations';
import { organizationGroups } from '@bitakit/organizations';
import { GroupActions } from './group-actions.js';
function InvitationDate({ value }: { value?: string }) {
  const { locale } = useAuth();
  const translateUI = useTranslation();
  if (!value || Number.isNaN(Date.parse(value)))
    return (
      <span className="text-muted-foreground">
        {translateUI('foundationUI.incoming_invitations.notSpecified', undefined, 'Not specified')}
      </span>
    );
  return (
    <time dateTime={value} className="flex flex-col gap-1 whitespace-nowrap">
      <span>
        {new Intl.DateTimeFormat(locale.languageTag, { dateStyle: 'medium' }).format(
          new Date(value),
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {new Intl.DateTimeFormat(locale.languageTag, { timeStyle: 'short' }).format(
          new Date(value),
        )}
      </span>
    </time>
  );
}
/** `embedded`: rendered inside a host frame that owns the page title and width. */
export function IncomingInvitations({ embedded = false }: { embedded?: boolean }) {
  const translateUI = useTranslation();
  const service = getService(useFoundation().runtime.services, organizationService);
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [invitation] = useQueryState('invitation', parseAsString.withDefault(''));
  const [search, setSearch] = useQueryState(
    'invitationSearch',
    parseAsString.withDefault('').withOptions({ history: 'replace' }),
  );
  const pending = state.incomingInvitations?.filter((item) => item.status === 'pending') ?? [];
  const incoming = pending.filter((item) =>
    `${item.organizationName} ${item.email}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className={cn('flex w-full min-w-0 flex-col gap-6', !embedded && 'mx-auto max-w-5xl')}>
      <PageHeader
        level={embedded ? 2 : 1}
        title={translateUI(
          'foundationUI.incoming_invitations.invitationsForMe',
          undefined,
          'Invitations for me',
        )}
        subtitle={translateUI(
          'foundationUI.incoming_invitations.invitationsToJoinOtherOrganizationsWithYourAccount',
          undefined,
          'Invitations to join other organizations with your account.',
        )}
        trailing={
          <GroupActions
            group={organizationGroups.toolbar}
            context={{ organizationId: null }}
            iconOnly
          />
        }
      />
      {state.incomingInvitationsError ? (
        <p role="status">{state.incomingInvitationsError}</p>
      ) : !service.capabilities.invitations ? (
        <p className="text-sm text-muted-foreground">
          {translateUI(
            'foundationUI.incoming_invitations.thisProviderDoesNotSupportInvitations',
            undefined,
            'This provider does not support invitations.',
          )}
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <InputGroup className="w-full sm:max-w-xs">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={translateUI(
                'foundationUI.incoming_invitations.searchInvitations',
                undefined,
                'Search invitations…',
              )}
              placeholder={translateUI(
                'foundationUI.incoming_invitations.searchInvitations',
                undefined,
                'Search invitations…',
              )}
              value={search}
              onChange={(event) => {
                void setSearch(event.target.value);
              }}
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupClearButton
                  aria-label={translateUI(
                    'foundationUI.incoming_invitations.clearInvitationSearch',
                    undefined,
                    'Clear invitation search',
                  )}
                  onClear={() => {
                    void setSearch(null);
                  }}
                />
              </InputGroupAddon>
            )}
          </InputGroup>
          {invitation && !pending.some((item) => item.id === invitation) && state.loaded && (
            <p role="status" className="text-sm text-muted-foreground">
              {translateUI(
                'foundationUI.incoming_invitations.thisInvitationIsUnavailableSignInWithTheInvitedEmailAddressIt',
                undefined,
                'This invitation is unavailable. Sign in with the invited email address; it may also have expired or already been answered.',
              )}
            </p>
          )}
          <Table className="min-w-3xl table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>
                  {translateUI(
                    'foundationUI.incoming_invitations.organization',
                    undefined,
                    'Organization',
                  )}
                </TableHead>
                <TableHead className="w-28">
                  {translateUI('foundationUI.incoming_invitations.role', undefined, 'Role')}
                </TableHead>
                <TableHead className="w-28">
                  {translateUI('foundationUI.incoming_invitations.status', undefined, 'Status')}
                </TableHead>
                <TableHead className="w-32">
                  {translateUI(
                    'foundationUI.incoming_invitations.invitedOn',
                    undefined,
                    'Invited on',
                  )}
                </TableHead>
                <TableHead className="w-32">
                  {translateUI(
                    'foundationUI.incoming_invitations.validUntil',
                    undefined,
                    'Valid until',
                  )}
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">
                    {translateUI('foundationUI.incoming_invitations.actions', undefined, 'Actions')}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incoming.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-3">
                      <Avatar aria-hidden="true">
                        {(item.organizationLogo ??
                          state.organizations.find((org) => org.id === item.organizationId)
                            ?.logo) && (
                          <AvatarImage
                            src={
                              (item.organizationLogo ??
                                state.organizations.find((org) => org.id === item.organizationId)
                                  ?.logo)!
                            }
                            alt=""
                          />
                        )}
                        <AvatarFallback>
                          {item.organizationName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
                        <span className="font-medium">{item.organizationName}</span>
                        <span className="text-xs text-muted-foreground">
                          {translateUI(
                            'foundationUI.incoming_invitations.invitedAs',
                            undefined,
                            'Invited as',
                          )}{' '}
                          {item.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <MemberRoleIcon role={item.role} />
                      {(
                        {
                          owner: translateUI(
                            'foundationUI.incoming_invitations.owner',
                            undefined,
                            'Owner',
                          ),
                          admin: translateUI(
                            'foundationUI.incoming_invitations.admin',
                            undefined,
                            'Admin',
                          ),
                          member: translateUI(
                            'foundationUI.incoming_invitations.member',
                            undefined,
                            'Member',
                          ),
                        } as Record<string, string>
                      )[item.role] ?? item.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <MemberStatusIcon status="pending" />
                      {translateUI(
                        'foundationUI.incoming_invitations.pending',
                        undefined,
                        'Pending',
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <InvitationDate value={item.createdAt} />
                  </TableCell>
                  <TableCell>
                    <InvitationDate value={item.expiresAt} />
                  </TableCell>
                  <TableCell>
                    <GroupActions
                      menu
                      group={organizationGroups.incoming}
                      context={{ organizationId: null, invitationId: item.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!incoming.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {!state.loaded
                      ? translateUI(
                          'foundationUI.incoming_invitations.loadingInvitations',
                          undefined,
                          'Loading invitations…',
                        )
                      : search
                        ? translateUI(
                            'foundationUI.incoming_invitations.noMatchingInvitationsFound',
                            undefined,
                            'No matching invitations found.',
                          )
                        : translateUI(
                            'foundationUI.incoming_invitations.youHaveNoPendingInvitations',
                            undefined,
                            'You have no pending invitations.',
                          )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
