'use client';
import { useTranslation } from '@bitakit/ui';
import { MemberRoleIcon, MemberStatusIcon } from './people-icons.js';
import { Alert, AlertDescription } from '../ui/index.js';
import { PageHeader } from '../ui/index.js';
import { IncomingInvitations } from './incoming-invitations.js';
import { usePeopleFilters, PeopleFilters, PeoplePagination } from './people-filters.js';
import { Tabs, TabsList, TabsTrigger } from '../ui/index.js';
import { useSyncExternalStore } from 'react';
import { cn } from 'cn';
import { getService } from '@bitakit/core';
import { useFoundation } from '@bitakit/ui';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/index.js';
import { Badge } from '../ui/index.js';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '../ui/index.js';
import { organizationService } from '@bitakit/organizations';
import { SlotActions, MemberMenu } from './group-actions.js';
import type { Member, Invitation } from '@bitakit/organizations';

function MemberActions({ member, organizationId }: { member: Member; organizationId: string }) {
  return <MemberMenu payload={{ organizationId, memberId: member.id }} />;
}
function InvitationActions({
  invitation,
  organizationId,
}: {
  invitation: Invitation;
  organizationId: string;
}) {
  return (
    <SlotActions
      menu
      slot="organizations.invitation"
      context={{ organizationId, invitationId: invitation.id }}
    />
  );
}
export function OrganizationsPage({
  demo = false,
  view,
  embedded = false,
}: {
  demo?: boolean;
  view?: 'current' | 'pending';
  /** Rendered inside a host frame that owns the page title and width. */
  embedded?: boolean;
} = {}) {
  const translateUI = useTranslation();
  const roleLabel = (role: string) =>
    role
      .split(',')
      .map((value) => translateUI(`foundationUI.roles.${value}`, undefined, value))
      .join(', ');
  const service = getService(useFoundation().runtime.services, organizationService);
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const active = state.organizations.find((item) => item.id === state.activeId);
  const model = usePeopleFilters(view);
  const { matches } = model;
  const filters = { ...model.filters, tab: view ?? model.filters.tab };
  const allMembers = state.members.filter(
    (item) =>
      matches(item) &&
      (filters.status === 'all' || (item.disabled ? 'disabled' : 'active') === filters.status),
  );
  const allInvitations = state.invitations.filter(
    (item) => item.status === 'pending' && matches(item),
  );
  const total = filters.tab === 'current' ? allMembers.length : allInvitations.length;
  const page = Math.min(
    Math.max(1, filters.page),
    Math.max(1, Math.ceil(total / filters.pageSize)),
  );
  const offset = (page - 1) * filters.pageSize;
  const members = allMembers.slice(offset, offset + filters.pageSize);
  const invitations = allInvitations.slice(offset, offset + filters.pageSize);
  return (
    <section
      className={cn('flex w-full min-w-0 flex-col gap-6', !embedded && 'mx-auto max-w-5xl')}
      aria-busy={state.pending}
    >
      <PageHeader
        showTitle={!embedded}
        level={embedded ? 2 : 1}
        title={
          view === 'pending'
            ? translateUI('foundationUI.pages.invitations', undefined, 'Invitations')
            : translateUI('foundationUI.pages.members', undefined, 'Members')
        }
        subtitle={translateUI(
          'foundationUI.pages.membersAndInvitationsInTheActiveWorkspace',
          undefined,
          'Members and invitations in the active workspace.',
        )}
        trailing={
          <>
            <SlotActions
              iconOnly
              slot="organizations.toolbar"
              context={{ organizationId: state.activeId }}
            />
            {state.canManage && (
              <SlotActions
                slot="organizations.members"
                context={{ organizationId: state.activeId }}
                size="default"
                variant="default"
              />
            )}
          </>
        }
      />
      {demo && (
        <Alert role="note">
          <AlertDescription>
            {translateUI(
              'foundationUI.pages.pluginTestWithSampleDataNoRealSigninOrEmailDeliveryChanges',
              undefined,
              'Plugin test with sample data. No real sign-in or email delivery; changes last until reload.',
            )}
          </AlertDescription>
        </Alert>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {!state.loaded && state.pending && (
        <p role="status">
          {translateUI(
            'foundationUI.pages.loadingOrganizations',
            undefined,
            'Loading organizations…',
          )}
        </p>
      )}
      {active && (
        <>
          <div className="flex min-w-0 flex-col gap-4">
            {!view && (
              <Tabs
                value={filters.tab}
                onValueChange={(tab) =>
                  void model.set({
                    tab: tab === 'pending' ? 'pending' : 'current',
                    page: 1,
                    role: null,
                  })
                }
              >
                <TabsList
                  variant="line"
                  aria-label={translateUI('foundationUI.pages.people', undefined, 'People')}
                >
                  <TabsTrigger value="current">
                    {translateUI('foundationUI.pages.members', undefined, 'Members')}
                    <Badge variant="secondary">{state.members.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="pending">
                    {translateUI(
                      'foundationUI.pages.pendingInvitations',
                      undefined,
                      'Pending invitations',
                    )}{' '}
                    <Badge variant="secondary">
                      {state.invitations.filter((item) => item.status === 'pending').length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <PeopleFilters model={model} />
          </div>
          {filters.tab === 'current' && (
            <div className="min-w-0">
              {!members.length && (
                <p>
                  {translateUI(
                    'foundationUI.pages.noMatchingMembers',
                    undefined,
                    'No matching members.',
                  )}
                </p>
              )}
              <div className="min-w-0">
                <Table className="min-w-2xl table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {translateUI('foundationUI.pages.member', undefined, 'Member')}
                      </TableHead>
                      <TableHead>
                        {translateUI('foundationUI.pages.status', undefined, 'Status')}
                      </TableHead>
                      <TableHead className="w-1/5">
                        {translateUI('foundationUI.pages.role', undefined, 'Role')}
                      </TableHead>
                      <TableHead>
                        <span className="sr-only">
                          {translateUI('foundationUI.pages.actions', undefined, 'Actions')}
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="whitespace-normal [overflow-wrap:anywhere]">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar aria-hidden="true">
                              {member.image && <AvatarImage src={member.image} alt="" />}
                              <AvatarFallback>
                                {(member.name.trim() || member.email)
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join('')
                                  .toLocaleUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-muted-foreground">{member.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.disabled ? 'error' : 'success'}>
                            <MemberStatusIcon status={member.disabled ? 'disabled' : 'active'} />
                            {member.disabled
                              ? translateUI('foundationUI.pages.suspended', undefined, 'Suspended')
                              : translateUI('foundationUI.pages.active', undefined, 'Active')}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Badge variant="secondary">
                            <MemberRoleIcon role={member.role} />
                            {roleLabel(member.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <MemberActions member={member} organizationId={active.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {filters.tab === 'pending' && (
            <div className="min-w-0">
              {!invitations.length ? (
                <p className="text-sm text-muted-foreground">
                  {translateUI(
                    'foundationUI.pages.noPendingInvitations',
                    undefined,
                    'No pending invitations.',
                  )}
                </p>
              ) : (
                <>
                  <div className="min-w-0">
                    <Table className="min-w-2xl table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            {translateUI('foundationUI.pages.email', undefined, 'Email')}
                          </TableHead>
                          <TableHead>
                            {translateUI('foundationUI.pages.status', undefined, 'Status')}
                          </TableHead>
                          <TableHead className="w-1/5">
                            {translateUI('foundationUI.pages.role', undefined, 'Role')}
                          </TableHead>
                          <TableHead>
                            <span className="sr-only">
                              {translateUI('foundationUI.pages.actions', undefined, 'Actions')}
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="whitespace-normal [overflow-wrap:anywhere]">
                              {item.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant="warning">
                                <MemberStatusIcon status="pending" />
                                {translateUI('foundationUI.pages.pending', undefined, 'Pending')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                <MemberRoleIcon role={item.role} />
                                {roleLabel(item.role)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <InvitationActions invitation={item} organizationId={active.id} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
          <PeoplePagination model={model} total={total} />
        </>
      )}
    </section>
  );
}
