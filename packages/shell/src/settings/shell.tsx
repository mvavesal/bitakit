'use client';
import { useTranslation } from '@bitakit/ui';
import { Suspense, useId, type ElementType, type ReactNode } from 'react';
import { useSettingsSections, useSettingsText } from '@bitakit/app-preferences';
import { projectSettings } from '@bitakit/app-preferences/core';
import { parseAsString, useQueryState } from 'nuqs';
import { 
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
 } from '../components/ui/index.js';
import {  TooltipProvider  } from '../components/ui/index.js';
import { 
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupClearButton,
 } from '../components/ui/index.js';
import {  Button  } from '../components/ui/index.js';
import {  BackLink  } from '../components/ui/index.js';
import SearchIcon from 'reicon-react/icons/Search';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import { SettingsNavigationLink } from './link.js';

const defaultLabels = {
  title: 'Einstellungen',
  back: 'Zurück zum Studio',
  navigation: 'Einstellungsnavigation',
  toggle: 'Einstellungsnavigation umschalten',
  breadcrumb: 'Brotkrümelnavigation',
  search: 'Einstellungen durchsuchen',
  placeholder: 'Einstellungen durchsuchen …',
  clear: 'Suche löschen',
  empty: 'Keine Einstellungen gefunden',
  skip: 'Zu den Einstellungen',
};
export type SettingsShellLabels = typeof defaultLabels;
export type SettingsShellProps = {
  children: ReactNode;
  pathname: string;
  linkComponent?: ElementType;
  backHref: string;
  labels?: Partial<SettingsShellLabels>;
  /** Same sidebar and mobile drawer inside a host-owned dialog. */
  embedded?: boolean;
};

function Navigation({
  pathname,
  linkComponent: Link = 'a',
  backHref,
  labels,
  embedded,
}: Omit<SettingsShellProps, 'children' | 'labels'> & { labels: SettingsShellLabels }) {
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ history: 'replace' }),
  );
  const { setOpenMobile, isMobile } = useSidebar();
  return (
    <Sidebar
      mobileTitle={labels.navigation}
      mobileDescription={labels.search}
      collapsible={embedded && !isMobile ? 'none' : 'offcanvas'}
      className={embedded && !isMobile ? 'min-h-0 shrink-0 border-r' : undefined}
    >
      <SidebarHeader className="gap-5 px-3 pt-4 pb-2">
        {!embedded && (
          <BackLink as={Link} href={backHref}>
            {labels.back}
          </BackLink>
        )}
        {pathname !== '/settings' && (
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={labels.search}
              placeholder={labels.placeholder}
              value={query}
              onChange={(event) => {
                void setQuery(event.target.value);
              }}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupClearButton
                  aria-label={labels.clear}
                  onClear={() => {
                    void setQuery(null);
                  }}
                />
              </InputGroupAddon>
            )}
          </InputGroup>
        )}
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SettingsNavigation
          pathname={pathname}
          linkComponent={Link}
          query={query}
          labels={labels}
          onNavigate={() => setOpenMobile(false)}
        />
      </SidebarContent>
    </Sidebar>
  );
}

/** Catalog navigation also usable in host previews without a sidebar provider. */
export function SettingsNavigation({
  pathname,
  linkComponent: Link = 'a',
  query = '',
  labels: overrides,
  onNavigate,
}: {
  pathname: string;
  linkComponent?: ElementType;
  query?: string;
  labels?: Partial<SettingsShellLabels>;
  onNavigate?: () => void;
}) {
  const t = useTranslation();
  const labels = { ...Object.fromEntries(Object.entries(defaultLabels).map(([key, value]) => [key, t(`shell.settingsShell.${key}`, undefined, value)])) as SettingsShellLabels, ...overrides };
  const text = useSettingsText();
  const sections = useSettingsSections();
  const groups = projectSettings(
    sections.filter((s) => s.component || s.groups.length || s.fields.length),
    query,
  );
  return (
    <nav aria-label={labels.navigation}>
      {groups.map(({ group, entries }) => (
        <SidebarGroup key={group?.id ?? ''}>
          {group && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
          <SidebarMenu>
            {entries.map(({ action: section }) => (
              <SidebarMenuItem key={section.id}>
                <Button
                  asChild
                  className="w-full justify-start"
                  variant={pathname === section.href ? 'secondary' : 'ghost'}
                >
                  <Link
                    href={section.enabled ? section.href : '#'}
                    aria-disabled={!section.enabled || undefined}
                    tabIndex={section.enabled ? undefined : -1}
                    aria-current={pathname === section.href ? 'page' : undefined}
                    onClick={(event: { preventDefault(): void }) => {
                      if (!section.enabled) {
                        event.preventDefault();
                        return;
                      }
                      onNavigate?.();
                    }}
                  >
                    {section.icon && <section.icon data-icon="inline-start" aria-hidden="true" />}
                    <span className="truncate">{text.sectionTitle(section)}</span>
                  </Link>
                </Button>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
      {!groups.length && (
        <p role="status" className="px-3 text-sm text-muted-foreground">
          {labels.empty}
        </p>
      )}
    </nav>
  );
}

/** The host supplies routing and translations. */
export function SettingsShell({
  children,
  pathname,
  linkComponent: Link = 'a',
  labels: overrides,
  embedded,
  ...props
}: SettingsShellProps) {
  const t = useTranslation();
  const labels = { ...Object.fromEntries(Object.entries(defaultLabels).map(([key, value]) => [key, t(`shell.settingsShell.${key}`, undefined, value)])) as SettingsShellLabels, ...overrides };
  const text = useSettingsText();
  const contentId = useId();
  const section = useSettingsSections().find(
    (s) => s.visible && `/settings/${s.path}` === pathname,
  );
  return (
    <SettingsNavigationLink.Provider value={Link}>
      <TooltipProvider>
        <SidebarProvider className={embedded ? 'min-h-0 flex-1 overflow-hidden' : undefined}>
          <a
            href={`#${contentId}`}
            className="sr-only focus:not-sr-only focus:absolute focus:bg-background focus:p-3"
          >
            {labels.skip}
          </a>
          <Suspense>
            <Navigation
              {...props}
              pathname={pathname}
              linkComponent={Link}
              embedded={embedded}
              labels={labels}
            />
          </Suspense>
          <SidebarInset className="min-h-0 min-w-0">
            <header className="flex h-14 shrink-0 items-center gap-3 px-4">
              <SidebarTrigger className="md:hidden" aria-label={labels.toggle} />
              <nav
                aria-label={labels.breadcrumb}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <Link href="/settings" className="text-muted-foreground">
                  {labels.title}
                </Link>
                {section && (
                  <>
                    <ChevronRightIcon className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate" aria-current="page">
                      {text.sectionTitle(section)}
                    </span>
                  </>
                )}
              </nav>
            </header>
            <div
              id={contentId}
              tabIndex={-1}
              className="mx-auto flex w-full min-h-0 min-w-0 max-w-4xl flex-1 flex-col gap-7 overflow-y-auto overscroll-contain p-4 md:p-8 lg:p-10"
            >
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </SettingsNavigationLink.Provider>
  );
}
