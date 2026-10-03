'use client';
import { useSettingsCatalog } from '@bitakit/ui';
import {
  Button,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@bitakit/ui/components';
import { visibleSections } from '../catalog.js';
import { groupByCategory } from '../categories.js';
import { normalizePath, sectionHref, withQuery } from '../paths.js';
import { searchSettings } from '../search.js';
import { iconOf } from './icon.js';
import { useSettingsLocation } from './location.js';
import { useCategoryTitle, useMessages } from './use-messages.js';

export type SettingsNavigationProps = {
  basePath?: string;
  /** The current path; the router's pathname when omitted. Its entry is marked current. */
  pathname?: string;
  /** Shows only the pages that match; navigation links keep it. */
  query?: string;
};

/**
 * The settings pages grouped by category, in category and section order. Renders sidebar
 * groups, so it belongs inside `SettingsShell` or another sidebar.
 */
export function SettingsNavigation(props: SettingsNavigationProps) {
  return <NavigationList {...props} />;
}

/** `SettingsNavigation` with a callback after a link is followed, used to close the drawer. */
export function NavigationList({
  basePath,
  pathname,
  query = '',
  onNavigate,
}: SettingsNavigationProps & { onNavigate?: () => void }) {
  const location = useSettingsLocation({ basePath, pathname });
  const messages = useMessages();
  const categoryTitle = useCategoryTitle();
  const results = searchSettings(visibleSections(useSettingsCatalog()), query);
  const groups = groupByCategory(results, (result) => result.section.category, categoryTitle);
  const current = location.pathname === undefined ? undefined : normalizePath(location.pathname);
  const { Link } = location;
  return (
    <nav aria-label={messages('navigation')} className="flex min-w-0 flex-col">
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          <SidebarGroupLabel asChild>
            <h2>{group.title}</h2>
          </SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map(({ section }) => {
              const href = sectionHref(location.basePath, section);
              const active = href === current;
              const Icon = iconOf(section.icon);
              return (
                <SidebarMenuItem key={section.id}>
                  <Button
                    asChild
                    variant={active ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <Link
                      href={withQuery(href, query)}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                    >
                      {Icon && <Icon aria-hidden="true" data-icon="inline-start" />}
                      <span className="truncate">{section.title}</span>
                    </Link>
                  </Button>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
      {!groups.length && (
        <p role="status" className="px-4 text-sm text-muted-foreground">
          {messages('noResults')}
        </p>
      )}
    </nav>
  );
}
