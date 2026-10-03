'use client';
import { useTranslation } from '@bitakit/ui';
import { useState, useSyncExternalStore } from 'react';
import { getService } from '@bitakit/core';
import { useFoundation, useActionList } from '@bitakit/ui';
import { SidebarIdentity } from '../ui/index.js';
import { useSidebar } from '../ui/index.js';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/index.js';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/index.js';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from '../ui/index.js';
import { organizationService } from '@bitakit/organizations';
import PlusIcon from 'reicon-react/icons/Plus';

export function OrganizationSwitcher({ side }: { side?: 'bottom' | 'right' } = {}) {
  const translateUI = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();
  const service = getService(useFoundation().runtime.services, organizationService);
  const actions = useActionList();
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const active = state.organizations.find((org) => org.id === state.activeId);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  async function run(id: string, input?: unknown) {
    setError(false);
    try {
      await actions.execute(id, input);
      setOpen(false);
      setSearch('');
      setOpenMobile(false);
    } catch {
      setError(true);
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <SidebarIdentity
          aria-label={translateUI(
            'foundationUI.switcher.switchOrganization',
            undefined,
            'Switch organization',
          )}
          name={
            state.pending
              ? translateUI(
                  'foundationUI.switcher.loadingOrganizations',
                  undefined,
                  'Loading organizations…',
                )
              : (active?.name ??
                translateUI(
                  'foundationUI.switcher.selectOrganization',
                  undefined,
                  'Select organization',
                ))
          }
          aria-busy={state.pending}
          avatar={
            <Avatar>
              {active?.logo && <AvatarImage src={active.logo} alt="" />}
              <AvatarFallback>{active?.name.slice(0, 2).toUpperCase() ?? 'O'}</AvatarFallback>
            </Avatar>
          }
        />
      </PopoverTrigger>
      <PopoverContent
        side={side ?? (isMobile ? 'bottom' : 'right')}
        sideOffset={4}
        align="start"
        className="w-72 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <Command>
          <CommandInput
            quiet
            value={search}
            onValueChange={setSearch}
            onClear={search ? () => setSearch('') : undefined}
            clearLabel={translateUI('foundationUI.switcher.clearSearch', undefined, 'Clear search')}
            placeholder={translateUI(
              'foundationUI.switcher.searchOrganizations',
              undefined,
              'Search organizations',
            )}
            aria-label={translateUI(
              'foundationUI.switcher.searchOrganizations',
              undefined,
              'Search organizations',
            )}
          />
          <CommandSeparator alwaysRender />
          <CommandList>
            <CommandEmpty>
              {state.pending
                ? translateUI(
                    'foundationUI.switcher.loadingOrganizations',
                    undefined,
                    'Loading organizations…',
                  )
                : translateUI(
                    'foundationUI.switcher.noOrganizationsFound',
                    undefined,
                    'No organizations found.',
                  )}
            </CommandEmpty>
            <CommandGroup>
              {state.organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  keywords={[org.name, org.slug]}
                  data-checked={org.id === state.activeId}
                  className="gap-3 p-2"
                  disabled={state.pending}
                  onSelect={() => void run('organizations.select', { organizationId: org.id })}
                >
                  <Avatar size="sm">
                    {org.logo && <AvatarImage src={org.logo} alt="" />}
                    <AvatarFallback>{org.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{org.name}</span>
                  {org.id === state.activeId && (
                    <span className="sr-only">
                      {translateUI('foundationUI.switcher.active', undefined, 'Active')}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator alwaysRender />
            <CommandGroup forceMount>
              <CommandItem
                value="create-organization"
                forceMount
                onSelect={() => {
                  setOpen(false);
                  void run('organizations.create');
                }}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border-(length:--border-width)">
                  <PlusIcon aria-hidden="true" />
                </span>
                {translateUI(
                  'foundationUI.switcher.addOrganization',
                  undefined,
                  'Add organization',
                )}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        {(error || state.error) && (
          <p role="alert">
            {state.error ??
              translateUI(
                'foundationUI.switcher.theOperationFailed',
                undefined,
                'The operation failed.',
              )}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
