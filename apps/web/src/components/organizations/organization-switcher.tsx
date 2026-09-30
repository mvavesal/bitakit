'use client';

import { useQueryState } from 'nuqs';
import { organizationDialogParser } from './organization-create-dialog';
import { SettingsLink } from '@/components/settings/base/settings-link';
import SettingsIcon from 'reicon-react/icons/Settings';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BuildingIcon from 'reicon-react/icons/Building';
import ChevronExpandYIcon from 'reicon-react/icons/ChevronExpandY';
import PlusIcon from 'reicon-react/icons/Plus';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useActiveOrganization } from '@/providers/organization-provider';
import { authClient } from '@/lib/auth-client';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';

export function OrganizationSwitcher() {
  const t = useTranslations('Organizations');
  const organizations = authClient.useListOrganizations();
  const active = useActiveOrganization();
  const { isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [, setCreate] = useQueryState('organization', organizationDialogParser);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function select(organizationId: string) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) setError(t('switchError'));
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError(t('connectionError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) setSearch('');
          }}
        >
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t('switcher')}
              disabled={pending}
              tooltip={t('switcher')}
            >
              <Avatar>
                {active.data?.logo && (
                  <AvatarImage src={active.data.logo} alt="" referrerPolicy="no-referrer" />
                )}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  <BuildingIcon className="size-4" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active.data?.name ?? (active.isPending ? t('loading') : 'SaaS Foundation')}
                </span>
                <span className="truncate text-xs text-muted-foreground">{t('workspace')}</span>
              </div>
              <ChevronExpandYIcon
                className="ml-auto opacity-0 transition-opacity group-hover/menu-button:opacity-100 group-focus-visible/menu-button:opacity-100 group-data-[state=open]/menu-button:opacity-100"
                aria-hidden="true"
              />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
            className="w-max min-w-72 max-w-[calc(100vw-2rem)] gap-0 p-0"
          >
            <Command>
              <CommandInput
                quiet
                placeholder={t('search')}
                aria-label={t('search')}
                value={search}
                onValueChange={setSearch}
                onClear={search ? () => setSearch('') : undefined}
                clearLabel={t('clearSearch')}
              />
              <CommandSeparator alwaysRender />
              <CommandList label={t('yours')} className="max-h-none overflow-visible">
                <CommandEmpty>{t('noResults')}</CommandEmpty>
                <CommandGroup className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-7rem))] overflow-y-auto">
                  {organizations.error || active.error ? (
                    <CommandItem disabled>{t('loadError')}</CommandItem>
                  ) : organizations.isPending ? (
                    <CommandItem disabled>{t('loading')}</CommandItem>
                  ) : (
                    organizations.data?.map((org) => (
                      <CommandItem
                        key={org.id}
                        value={org.id}
                        keywords={[org.name, org.slug]}
                        data-checked={active.data?.id === org.id}
                        disabled={pending}
                        className="gap-3 p-2"
                        onSelect={() => void select(org.id)}
                      >
                        <Avatar size="sm">
                          {org.logo && (
                            <AvatarImage src={org.logo} alt="" referrerPolicy="no-referrer" />
                          )}
                          <AvatarFallback>
                            <BuildingIcon aria-hidden="true" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{org.name}</span>
                        {active.data?.id === org.id && (
                          <span className="sr-only">{t('active')}</span>
                        )}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
                <CommandSeparator alwaysRender />
                <CommandGroup forceMount>
                  {active.data && (
                    <CommandItem forceMount value="organization-settings" asChild>
                      <SettingsLink
                        href="/settings/organization"
                        onClick={() => {
                          setOpen(false);
                          setOpenMobile(false);
                        }}
                      >
                        <SettingsIcon aria-hidden="true" />
                        {t('settings')}
                      </SettingsLink>
                    </CommandItem>
                  )}
                  <CommandItem
                    forceMount
                    value="create-organization"
                    className="gap-3 p-2"
                    onSelect={() => {
                      setOpen(false);
                      setOpenMobile(false);
                      void setCreate('new');
                    }}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border">
                      <PlusIcon aria-hidden="true" />
                    </span>
                    <span className="whitespace-nowrap">{t('createTitle')}</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {error && (
          <p role="alert" className="px-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
