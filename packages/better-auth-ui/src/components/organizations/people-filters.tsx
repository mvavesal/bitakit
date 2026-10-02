'use client';
import { useTranslation } from '@bitakit/ui';
import { MemberRoleIcon, MemberStatusIcon } from './people-icons.js';
import { useEffect } from 'react';
import {
  createParser,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { DateRangeFilter } from '../ui/index.js';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupClearButton,
} from '../ui/index.js';
import SearchIcon from 'reicon-react/icons/Search';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import RoleIcon from 'reicon-react/icons/Users';
import StatusIcon from 'reicon-react/icons/CheckCircle';
import { Button } from '../ui/index.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../ui/index.js';
const date = createParser({
  parse(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
      ? value
      : null;
  },
  serialize: String,
}).withDefault('');
export function Choice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: readonly (readonly [string, string])[];
  onChange(value: string): void;
}) {
  const translateUI = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={label}>
          {label === translateUI('foundationUI.people_filters.role', undefined, 'Role') && (
            <RoleIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {label === translateUI('foundationUI.people_filters.status', undefined, 'Status') && (
            <StatusIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {label}
          {value !== 'all' && `: ${choices.find(([key]) => key === value)?.[1]}`}
          <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {choices.map(([key, title]) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {key !== 'all' &&
                (label === translateUI('foundationUI.people_filters.role', undefined, 'Role') ? (
                  <MemberRoleIcon role={key} />
                ) : label ===
                  translateUI('foundationUI.people_filters.status', undefined, 'Status') ? (
                  <MemberStatusIcon status={key} />
                ) : null)}
              {title}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function usePeopleFilters(view?: 'current' | 'pending') {
  const [filters, set] = useQueryStates(
    {
      tab: parseAsStringLiteral(['current', 'pending'] as const).withDefault('current'),
      q: parseAsString.withDefault(''),
      from: date,
      to: date,
      role: parseAsStringLiteral(['all', 'owner', 'admin', 'member'] as const).withDefault('all'),
      status: parseAsStringLiteral(['all', 'active', 'disabled'] as const).withDefault('all'),
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsNumberLiteral([5, 10, 20, 50]).withDefault(10),
    },
    {
      history: 'replace',
      urlKeys: {
        tab: 'people',
        q: 'peopleSearch',
        from: 'joinedFrom',
        to: 'joinedTo',
        role: 'memberRole',
        status: 'memberStatus',
        page: 'peoplePage',
        pageSize: 'peopleSize',
      },
    },
  );
  const currentFilters = { ...filters, tab: view ?? filters.tab };
  useEffect(() => {
    if (currentFilters.tab === 'pending' && filters.role === 'owner')
      void set({ role: null, page: null });
  }, [currentFilters.tab, filters.role, set]);
  const matches = (item: { name?: string; email: string; role: string; createdAt?: string }) => {
    const query = filters.q.trim().toLocaleLowerCase();
    const created = item.createdAt?.slice(0, 10);
    return (
      (!query || `${item.name ?? ''} ${item.email}`.toLocaleLowerCase().includes(query)) &&
      (filters.role === 'all' || item.role.split(',').includes(filters.role)) &&
      (!filters.from || (!!created && created >= filters.from)) &&
      (!filters.to || (!!created && created <= filters.to))
    );
  };
  return { filters: currentFilters, set, matches };
}
export function PeopleFilters({ model }: { model: ReturnType<typeof usePeopleFilters> }) {
  const translateUI = useTranslation();
  const { filters: f, set } = model;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <InputGroup className="w-full sm:w-64">
        <InputGroupInput
          aria-label={translateUI('foundationUI.people_filters.search', undefined, 'Search')}
          placeholder={translateUI(
            'foundationUI.people_filters.nameOrEmail',
            undefined,
            'Name or email',
          )}
          value={f.q}
          onChange={(e) => void set({ q: e.target.value, page: 1 })}
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        {f.q && (
          <InputGroupAddon align="inline-end">
            <InputGroupClearButton
              aria-label={translateUI(
                'foundationUI.people_filters.clearSearch',
                undefined,
                'Clear search',
              )}
              onClear={() => {
                void set({ q: null, page: 1 });
              }}
            />
          </InputGroupAddon>
        )}
      </InputGroup>
      <Choice
        label={translateUI('foundationUI.people_filters.role', undefined, 'Role')}
        value={f.role}
        choices={(
          [
            ['all', translateUI('foundationUI.people_filters.all', undefined, 'All')],
            ['owner', translateUI('foundationUI.people_filters.owner', undefined, 'Owner')],
            ['admin', translateUI('foundationUI.people_filters.admin', undefined, 'Admin')],
            ['member', translateUI('foundationUI.people_filters.member', undefined, 'Member')],
          ] as const
        ).filter(([role]) => f.tab !== 'pending' || role !== 'owner')}
        onChange={(value) => void set({ role: value as typeof f.role, page: 1 })}
      />
      {f.tab === 'current' && (
        <Choice
          label={translateUI('foundationUI.people_filters.status', undefined, 'Status')}
          value={f.status}
          choices={[
            ['all', translateUI('foundationUI.people_filters.all', undefined, 'All')],
            ['active', translateUI('foundationUI.people_filters.active', undefined, 'Active')],
            [
              'disabled',
              translateUI('foundationUI.people_filters.suspended', undefined, 'Suspended'),
            ],
          ]}
          onChange={(value) => void set({ status: value as typeof f.status, page: 1 })}
        />
      )}
      <DateRangeFilter
        label={
          f.tab === 'current'
            ? translateUI('foundationUI.people_filters.joinDate', undefined, 'Join date')
            : translateUI(
                'foundationUI.people_filters.invitationDate',
                undefined,
                'Invitation date',
              )
        }
        from={f.from}
        to={f.to}
        onChange={({ from, to }) => {
          void set({ from: from || null, to: to || null, page: 1 });
        }}
      />
      {(f.q || f.from || f.to || f.role !== 'all' || f.status !== 'all') && (
        <Button
          variant="ghost"
          onClick={() =>
            void set({ q: null, role: null, status: null, from: null, to: null, page: null })
          }
        >
          {translateUI('foundationUI.people_filters.clearFilters', undefined, 'Clear filters')}
        </Button>
      )}
    </div>
  );
}
export function PeoplePagination({
  model,
  total,
}: {
  model: ReturnType<typeof usePeopleFilters>;
  total: number;
}) {
  const translateUI = useTranslation();
  const { filters: f, set } = model;
  const pages = Math.max(1, Math.ceil(total / f.pageSize));
  const page = Math.min(pages, Math.max(1, f.page));
  useEffect(() => {
    if (page !== f.page) void set({ page });
  }, [page, f.page, set]);
  return (
    <nav
      aria-label={translateUI('foundationUI.people_filters.pagination', undefined, 'Pagination')}
      className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4"
    >
      <Choice
        label={translateUI('foundationUI.people_filters.perPage', undefined, 'Per page')}
        value={String(f.pageSize)}
        choices={[5, 10, 20, 50].map((n) => [String(n), String(n)])}
        onChange={(value) => void set({ pageSize: Number(value) as typeof f.pageSize, page: 1 })}
      />
      <span className="text-sm" aria-live="polite">
        {translateUI(
          'foundationUI.people_filters.pageSummary',
          { total, page, pages },
          `${total} results · Page ${page} of ${pages}`,
        )}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => void set({ page: page - 1 })}
        >
          {translateUI('foundationUI.people_filters.back', undefined, 'Back')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => void set({ page: page + 1 })}
        >
          {translateUI('foundationUI.people_filters.next', undefined, 'Next')}
        </Button>
      </div>
    </nav>
  );
}
