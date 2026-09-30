'use client';
import { ActionMenu } from '@/components/navigation/action-menu';
import { actionGroups } from '@/actions/groups';
import {
  createParser,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { OrganizationMemberActions } from '@/components/organizations/organization-member-actions';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import MoreIcon from 'reicon-react/icons/MoreH';
import { DateRangeFilter } from '@/components/tables/date-range-filter';
import { TablePagination } from '@/components/tables/table-pagination';
import { PageHeader } from '@/components/layout/page-header';
import UserAddIcon from 'reicon-react/icons/UserAdd4';
import SearchIcon from 'reicon-react/icons/Search';
import FilterIcon from 'reicon-react/icons/DocumentFilter';
import StatusIcon from 'reicon-react/icons/CheckCircle';
import DisabledIcon from 'reicon-react/icons/UserBlock';
import PendingIcon from 'reicon-react/icons/Clock';
import RoleIcon from 'reicon-react/icons/Users';
import OwnerIcon from 'reicon-react/icons/Crown';
import AdminIcon from 'reicon-react/icons/ShieldCheck';
import MemberIcon from 'reicon-react/icons/User';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupClearButton,
  InputGroupText,
} from '@/components/ui/input-group';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  MAX_INVITATION_EXPIRY_DAYS,
  invitationExpiryDaysSchema,
} from '@/lib/organizations/invitation-schema';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { InvitationEmailInput } from '@/components/organizations/invitation-email-input';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notify } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const dateParser = createParser({
  parse: (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
      ? value
      : null;
  },
  serialize: (value) => value,
}).withDefault('');

const schema = z.object({
  email: z
    .string()
    .transform((value) => [
      ...new Set(
        value
          .split(/[;,\n]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.email()).min(1).max(20)),
  role: z.enum(['member', 'admin']),
  expiresInDays: invitationExpiryDaysSchema,
});
type Invitation = { id: string; email: string; role: string | null; createdAt: string };
type Member = {
  createdAt: string;
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  disabled: boolean;
};
export function OrganizationPeople({
  organizationId,
  members,
  invitations,
  canInvite,
  viewerMemberId,
  viewerRole,
  actions,
  title,
  subtitle,
  onRefresh,
}: {
  organizationId: string;
  members: Member[];
  invitations: Invitation[];
  canInvite: boolean;
  viewerMemberId: string;
  viewerRole: string;
  actions?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  onRefresh?: () => void;
}) {
  const t = useTranslations('Organizations');
  const format = useFormatter();
  const router = useRouter();
  const refresh = onRefresh ?? router.refresh;
  const [filters, setFilters] = useQueryStates(
    {
      tab: parseAsStringLiteral(['current', 'pending'] as const).withDefault('current'),
      q: parseAsString.withDefault(''),
      from: dateParser,
      to: dateParser,
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsNumberLiteral([5, 10, 20, 50]).withDefault(10),
      status: parseAsStringLiteral(['all', 'active', 'disabled', 'pending'] as const).withDefault(
        'all',
      ),
      role: parseAsStringLiteral(['all', 'owner', 'admin', 'member'] as const).withDefault('all'),
    },
    { history: 'replace' },
  );
  useEffect(() => {
    if (filters.tab === 'pending' && filters.role === 'owner')
      void setFilters({ role: null, page: null });
  }, [filters.tab, filters.role, setFilters]);
  const query = filters.q.trim().toLocaleLowerCase();
  const hasFilters =
    !!query ||
    !!filters.from ||
    !!filters.to ||
    filters.role !== 'all' ||
    (filters.tab === 'current' && filters.status !== 'all');
  const matches = (person: {
    email: string;
    name?: string;
    role: string | null;
    createdAt: string;
  }) =>
    (!query ||
      [person.name ?? '', person.email].some((value) =>
        value.toLocaleLowerCase().includes(query),
      )) &&
    (filters.role === 'all' || (person.role ?? '').split(',').includes(filters.role)) &&
    (!filters.from || person.createdAt.slice(0, 10) >= filters.from) &&
    (!filters.to || person.createdAt.slice(0, 10) <= filters.to);
  const visibleMembers = members.filter(
    (member) =>
      matches(member) &&
      (filters.status === 'all' || filters.status === (member.disabled ? 'disabled' : 'active')),
  );
  const visibleInvitations = invitations.filter(matches);
  const total = filters.tab === 'current' ? visibleMembers.length : visibleInvitations.length;
  const page = Math.min(
    Math.max(1, filters.page),
    Math.max(1, Math.ceil(total / filters.pageSize)),
  );
  const offset = (page - 1) * filters.pageSize;
  useEffect(() => {
    if (filters.page !== page) void setFilters({ page });
  }, [filters.page, page, setFilters]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member', expiresInDays: DEFAULT_INVITATION_EXPIRY_DAYS },
    mode: 'onTouched',
  });
  const emailValue = useWatch({ control: form.control, name: 'email' });
  const hasEmail = emailValue.split(/[;,\n]/).some((email) => email.trim().length > 0);
  const busy = form.formState.isSubmitting;
  async function invite(values: z.infer<typeof schema>) {
    setError(false);
    try {
      const failed: string[] = [];
      for (const email of values.email) {
        try {
          const result = await fetch('/api/organizations/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              role: values.role,
              organizationId,
              expiresInDays: values.expiresInDays,
            }),
          });
          if (!result.ok) failed.push(email);
        } catch {
          failed.push(email);
        }
      }
      if (failed.length < values.email.length) {
        notify.success('invitationCreated');
        void setFilters({
          tab: 'pending',
          q: null,
          role: null,
          status: null,
          from: null,
          to: null,
          page: null,
        });
        refresh();
      }
      if (failed.length) {
        form.setValue('email', failed.join(',') + ',');
        setError(true);
        notify.error('saveFailed');
      } else {
        setOpen(false);
        form.reset();
      }
    } catch {
      setError(true);
      notify.error('saveFailed');
    }
  }

  const roleLabel = (role: string | null) =>
    (role ?? '')
      .split(',')
      .map((value) => (['owner', 'admin', 'member'].includes(value) ? t(`role_${value}`) : value))
      .join(', ');
  return (
    <div className="flex min-w-0 flex-col gap-8 md:gap-10">
      <PageHeader
        title={title}
        subtitle={subtitle}
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {canInvite && (
              <Button
                onClick={() => {
                  setError(false);
                  setOpen(true);
                }}
              >
                <UserAddIcon data-icon="inline-start" aria-hidden="true" />
                {t('invite')}
              </Button>
            )}
          </div>
        }
      />
      <Tabs
        value={filters.tab}
        onValueChange={(value) =>
          void setFilters({
            tab: value === 'pending' ? 'pending' : 'current',
            role: value === 'pending' && filters.role === 'owner' ? null : filters.role,
            status: null,
            from: null,
            to: null,
            page: null,
          })
        }
        className="gap-6 md:gap-8"
      >
        <TabsList variant="line" aria-label={t('members')}>
          <TabsTrigger value="current">
            {t('currentMembers')} <Badge variant="secondary">{members.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            {t('pendingInvitations')} <Badge variant="secondary">{invitations.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <InputGroup className="w-full sm:w-64">
              <InputGroupInput
                aria-label={t('findPeople')}
                placeholder={t('findPeople')}
                value={filters.q}
                onChange={(event) => void setFilters({ q: event.target.value, page: null })}
              />
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              {filters.q && (
                <InputGroupAddon align="inline-end">
                  <InputGroupClearButton
                    aria-label={t('clearSearch')}
                    onClear={() => void setFilters({ q: null, page: null })}
                  />
                </InputGroupAddon>
              )}
            </InputGroup>
            {filters.tab === 'current' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" aria-label={t('filterStatus')}>
                    <StatusIcon data-icon="inline-start" aria-hidden="true" />
                    {t('status')}
                    {filters.status !== 'all' &&
                      `: ${t(filters.status === 'disabled' ? 'memberDisabled' : filters.status)}`}
                    <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>{t('status')}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={filters.status}
                    onValueChange={(value) =>
                      void setFilters({ status: value as typeof filters.status, page: null })
                    }
                  >
                    {(['all', 'active', 'disabled', 'pending'] as const).map((status) => (
                      <DropdownMenuRadioItem key={status} value={status}>
                        {status === 'active' ? (
                          <StatusIcon aria-hidden="true" />
                        ) : status === 'disabled' ? (
                          <DisabledIcon aria-hidden="true" />
                        ) : status === 'pending' ? (
                          <PendingIcon aria-hidden="true" />
                        ) : (
                          <FilterIcon aria-hidden="true" />
                        )}
                        {t(
                          status === 'all'
                            ? 'allStatuses'
                            : status === 'disabled'
                              ? 'memberDisabled'
                              : status,
                        )}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label={t('filterRole')}>
                  <RoleIcon data-icon="inline-start" aria-hidden="true" />
                  {t('role')}
                  {filters.role !== 'all' && `: ${roleLabel(filters.role)}`}
                  <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t('role')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.role}
                  onValueChange={(value) =>
                    void setFilters({
                      page: null,
                      role: ['owner', 'admin', 'member'].includes(value)
                        ? (value as 'owner' | 'admin' | 'member')
                        : 'all',
                    })
                  }
                >
                  {(['all', 'owner', 'admin', 'member'] as const)
                    .filter((role) => filters.tab !== 'pending' || role !== 'owner')
                    .map((role) => (
                      <DropdownMenuRadioItem key={role} value={role}>
                        {role === 'owner' ? (
                          <OwnerIcon aria-hidden="true" />
                        ) : role === 'admin' ? (
                          <AdminIcon aria-hidden="true" />
                        ) : role === 'member' ? (
                          <MemberIcon aria-hidden="true" />
                        ) : (
                          <RoleIcon aria-hidden="true" />
                        )}
                        {role === 'all' ? t('allRoles') : roleLabel(role)}
                      </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DateRangeFilter
              label={t(filters.tab === 'current' ? 'joinedDate' : 'inviteDate')}
              from={filters.from}
              to={filters.to}
              onChange={({ from, to }) =>
                void setFilters({ from: from || null, to: to || null, page: null })
              }
            />
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void setFilters({
                    q: null,
                    role: null,
                    status: null,
                    from: null,
                    to: null,
                    page: null,
                  })
                }
              >
                {t('clearFilters')}
              </Button>
            )}
          </div>
        </div>
        <TabsContent value="current">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('memberName')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead>{t('joinedDate')}</TableHead>
                <TableHead>
                  <span className="sr-only">{t('actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMembers.slice(offset, offset + filters.pageSize).map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {member.image && <AvatarImage src={member.image} alt="" />}
                        <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.disabled ? 'error' : 'success'}>
                      {member.disabled ? t('memberDisabled') : t('active')}
                    </Badge>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{roleLabel(member.role)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={member.createdAt}>
                      {format.dateTime(new Date(member.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </TableCell>
                  <TableCell className="text-right">
                    <OrganizationMemberActions
                      organizationId={organizationId}
                      member={member}
                      onRefresh={refresh}
                      canManage={
                        canInvite &&
                        member.id !== viewerMemberId &&
                        (!member.role.split(',').includes('owner') ||
                          (viewerRole.split(',').includes('owner') &&
                            members.filter((item) => item.role.split(',').includes('owner'))
                              .length > 1))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!visibleMembers.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <SearchIcon aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                          {hasFilters ? t('noPeopleResults') : t('noMembers')}
                        </EmptyTitle>
                        <EmptyDescription>
                          {hasFilters ? t('peopleSearchHint') : t('noMembersHint')}
                        </EmptyDescription>
                      </EmptyHeader>
                      {hasFilters && (
                        <EmptyContent>
                          <Button
                            variant="outline"
                            onClick={() =>
                              void setFilters({
                                q: null,
                                role: null,
                                status: null,
                                from: null,
                                to: null,
                                page: null,
                              })
                            }
                          >
                            {t('clearFilters')}
                          </Button>
                        </EmptyContent>
                      )}
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="pending" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('emailNotConfigured')}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead>{t('inviteDate')}</TableHead>
                {canInvite && (
                  <TableHead>
                    <span className="sr-only">{t('actions')}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleInvitations.slice(offset, offset + filters.pageSize).map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant="warning">{t('pending')}</Badge>
                  </TableCell>
                  <TableCell>{roleLabel(invitation.role)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={invitation.createdAt}>
                      {format.dateTime(new Date(invitation.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </TableCell>
                  {canInvite && (
                    <TableCell className="text-right">
                      <ActionMenu
                        groups={[actionGroups.invitation]}
                        context={{ organizationId, invitation, canInvite, refresh }}
                        header={invitation.email}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('personActions', { name: invitation.email })}
                          >
                            <MoreIcon aria-hidden="true" />
                          </Button>
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!visibleInvitations.length && (
                <TableRow>
                  <TableCell colSpan={canInvite ? 5 : 4}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <SearchIcon aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                          {hasFilters ? t('noPeopleResults') : t('noInvitations')}
                        </EmptyTitle>
                        <EmptyDescription>
                          {hasFilters ? t('peopleSearchHint') : t('noInvitationsHint')}
                        </EmptyDescription>
                      </EmptyHeader>
                      {hasFilters && (
                        <EmptyContent>
                          <Button
                            variant="outline"
                            onClick={() =>
                              void setFilters({
                                q: null,
                                role: null,
                                status: null,
                                from: null,
                                to: null,
                                page: null,
                              })
                            }
                          >
                            {t('clearFilters')}
                          </Button>
                        </EmptyContent>
                      )}
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TablePagination
          page={page}
          pageSize={filters.pageSize}
          total={total}
          onPageChange={(page) => void setFilters({ page })}
          onPageSizeChange={(pageSize) =>
            void setFilters({ pageSize: pageSize as 5 | 10 | 20 | 50, page: null })
          }
        />
      </Tabs>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('invite')}</DialogTitle>
            <DialogDescription>{t('emailNotConfigured')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(invite)} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">{t('email')}</Label>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <InvitationEmailInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={hasEmail && !!fieldState.error}
                    disabled={busy}
                  />
                )}
              />
              <p id="invite-email-hint" className="text-xs text-muted-foreground">
                {t('emailsHint')}
              </p>
              {hasEmail && form.formState.errors.email && (
                <p id="invite-email-error" className="text-sm text-destructive">
                  {t('invalidEmail')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <FieldGroup className="grid grid-cols-2 gap-4 sm:flex sm:flex-row sm:justify-between sm:gap-6">
                <Field className="min-w-0 gap-2 sm:w-40">
                  <FieldLabel id="invite-role-label">{t('role')}</FieldLabel>
                  <Controller
                    name="role"
                    control={form.control}
                    render={({ field }) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            aria-labelledby="invite-role-label invite-role-value"
                            className="w-full justify-between"
                          >
                            {field.value === 'admin' ? (
                              <AdminIcon data-icon="inline-start" aria-hidden="true" />
                            ) : (
                              <MemberIcon data-icon="inline-start" aria-hidden="true" />
                            )}
                            <span id="invite-role-value" className="flex-1 text-left">
                              {roleLabel(field.value)}
                            </span>
                            <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)]"
                        >
                          <DropdownMenuRadioGroup
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              field.onBlur();
                            }}
                          >
                            {(['member', 'admin'] as const).map((role) => (
                              <DropdownMenuRadioItem key={role} value={role}>
                                {role === 'admin' ? (
                                  <AdminIcon aria-hidden="true" />
                                ) : (
                                  <MemberIcon aria-hidden="true" />
                                )}
                                {roleLabel(role)}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  />
                </Field>
                <Field
                  className="min-w-0 gap-2 sm:w-40"
                  data-invalid={!!form.formState.errors.expiresInDays}
                  data-disabled={busy}
                >
                  <FieldLabel htmlFor="invite-expiry">{t('invitationExpiry')}</FieldLabel>
                  <InputGroup className="max-w-44 overflow-hidden" data-disabled={busy}>
                    <InputGroupInput
                      id="invite-expiry"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_INVITATION_EXPIRY_DAYS}
                      step={1}
                      disabled={busy}
                      aria-invalid={!!form.formState.errors.expiresInDays}
                      aria-describedby={
                        form.formState.errors.expiresInDays ? 'invite-expiry-error' : undefined
                      }
                      {...form.register('expiresInDays', { valueAsNumber: true })}
                    />
                    <InputGroupAddon
                      align="inline-end"
                      className="self-stretch border-l border-input bg-muted px-3"
                    >
                      <InputGroupText>{t('days')}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {form.formState.errors.expiresInDays && (
                    <FieldError id="invite-expiry-error">
                      {t('invitationExpiryInvalid', { max: MAX_INVITATION_EXPIRY_DAYS })}
                    </FieldError>
                  )}
                </Field>
              </FieldGroup>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t('inviteError')}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-7">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button disabled={busy || !hasEmail}>
                {busy ? t('wait') : t('createInvitation')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
