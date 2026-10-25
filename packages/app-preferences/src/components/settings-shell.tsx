'use client';
import { Suspense, useCallback, useId, type ReactNode } from 'react';
import { PluginSlot, useSettingsCatalog } from '@bitakit/ui';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@bitakit/ui/components';
import { visibleSections } from '../catalog.js';
import { isBasePath, normalizePath, sectionHref } from '../paths.js';
import { BackLink } from './back-link.js';
import { SettingsLocationContext, useSettingsLocation } from './location.js';
import { SearchField, useSettingsQuery } from './search-field.js';
import { NavigationList } from './settings-navigation.js';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb.js';
import { useMessages } from './use-messages.js';

export type SettingsShellProps = {
  basePath?: string;
  /** The current path; the router's pathname when omitted. */
  pathname?: string;
  /** Target of the back link. Default: `/`. */
  backHref?: string;
  /** Inside a host dialog: no back link, and the navigation stays open on wide screens. */
  embedded?: boolean;
  children: ReactNode;
};

function Search() {
  const messages = useMessages();
  const [query, setQuery] = useSettingsQuery();
  return (
    <SearchField
      label={messages('search')}
      placeholder={messages('searchPlaceholder')}
      clearLabel={messages('clearSearch')}
      value={query}
      onValueChange={setQuery}
      shortcut
    />
  );
}
function SearchingNavigation({ onNavigate }: { onNavigate: () => void }) {
  const [query] = useSettingsQuery();
  return <NavigationList query={query} onNavigate={onNavigate} />;
}

function Navigation({
  backHref,
  embedded,
  search,
}: {
  backHref: string;
  embedded: boolean;
  search: boolean;
}) {
  const messages = useMessages();
  const { Link } = useSettingsLocation({});
  const { isMobile, setOpenMobile } = useSidebar();
  const close = useCallback(() => setOpenMobile(false), [setOpenMobile]);
  const docked = embedded && !isMobile;
  const placeholder = (
    <SearchField
      label={messages('search')}
      placeholder={messages('searchPlaceholder')}
      clearLabel={messages('clearSearch')}
      value=""
    />
  );
  return (
    <Sidebar
      mobileTitle={messages('navigation')}
      mobileDescription={messages('search')}
      collapsible={docked ? 'none' : 'offcanvas'}
      className={docked ? 'min-h-0 shrink-0 border-r-(length:--border-width)' : undefined}
    >
      <SidebarHeader>
        <PluginSlot name="app-preferences.navigation.header" />
        {!embedded && (
          <BackLink as={Link} href={backHref}>
            {messages('back')}
          </BackLink>
        )}
        {search && (
          <Suspense fallback={placeholder}>
            <Search />
          </Suspense>
        )}
      </SidebarHeader>
      <SidebarContent>
        <Suspense fallback={<NavigationList onNavigate={close} />}>
          <SearchingNavigation onNavigate={close} />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <PluginSlot name="app-preferences.navigation.footer" />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * The settings frame: a sidebar with search and the pages by category (a drawer on narrow
 * screens), a skip link, the breadcrumb and the content area.
 */
export function SettingsShell({
  basePath,
  pathname,
  backHref = '/',
  embedded = false,
  children,
}: SettingsShellProps) {
  const location = useSettingsLocation({ basePath, pathname });
  const messages = useMessages();
  const contentId = useId();
  const current = location.pathname === undefined ? undefined : normalizePath(location.pathname);
  const section = visibleSections(useSettingsCatalog()).find(
    (entry) => sectionHref(location.basePath, entry) === current,
  );
  const { Link } = location;
  return (
    <SettingsLocationContext.Provider value={location}>
      <SidebarProvider
        className={embedded ? 'min-h-0 flex-1 overflow-hidden' : 'h-svh overflow-hidden'}
        shortcut={embedded ? false : undefined}
      >
        <a
          href={`#${contentId}`}
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-3"
        >
          {messages('skip')}
        </a>
        <Navigation
          backHref={backHref}
          embedded={embedded}
          search={current === undefined || !isBasePath(current, location.basePath)}
        />
        <SidebarInset className="min-h-0 min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-3 bg-card/50 px-4">
            <SidebarTrigger className="md:hidden" aria-label={messages('toggleNavigation')} />
            <Breadcrumb aria-label={messages('breadcrumb')} className="min-w-0">
              <BreadcrumbList>
                <BreadcrumbItem>
                  {section ? (
                    <BreadcrumbLink asChild>
                      <Link href={location.basePath}>{messages('settings')}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{messages('settings')}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {section && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                      <BreadcrumbPage className="truncate">{section.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div
            id={contentId}
            tabIndex={-1}
            className="mx-auto flex w-full min-h-0 min-w-0 max-w-4xl flex-1 flex-col gap-7 overflow-y-auto overscroll-contain p-4 outline-none md:p-8 lg:p-10"
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SettingsLocationContext.Provider>
  );
}
