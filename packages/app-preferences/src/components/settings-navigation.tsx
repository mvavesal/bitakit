'use client';
import { safeHref } from '@bitakit/core';
import { PluginSlot, useSettingsCatalog, useSlot, type SettingsCatalogSection } from '@bitakit/ui';
import {
  Button,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@bitakit/ui/components';
import { groupByCategory } from '../categories.js';
import { normalizePath, sectionHref, withQuery } from '../paths.js';
import { searchSettings } from '../search.js';
import { iconOf } from './icon.js';
import { useSettingsLocation } from './location.js';
import { useCategoryTitle, useMessages } from './use-messages.js';

export type SettingsNavigationProps = {
  basePath?: string;
  pathname?: string;
  /** Shows matching destinations; links between catalog pages preserve this query. */
  query?: string;
};
export function SettingsNavigation(props: SettingsNavigationProps) {
  return <NavigationList {...props} />;
}

/** Slot membership owns placement; the catalog supplies only page grouping and field search. */
export function NavigationList({
  basePath,
  pathname,
  query = '',
  onNavigate,
}: SettingsNavigationProps & { onNavigate?: () => void }) {
  const location = useSettingsLocation({ basePath, pathname });
  const messages = useMessages();
  const categoryTitle = useCategoryTitle();
  const catalog = useSettingsCatalog();
  const view = useSlot('app-preferences.navigation');
  if (view.error) throw view.error;
  const entries = view.items.flatMap((item) => {
    if (!safeHref(item.action.href)) return [];
    const source = catalog.find((section) => `settings.section.${section.id}` === item.actionId);
    const section: SettingsCatalogSection = {
      ...(source ?? {
        id: item.actionId,
        plugin: item.plugin,
        app: false,
        path: '',
        category: 'general',
        fields: [],
        order: item.order ?? 0,
      }),
      title: item.action.title,
      description: item.action.description,
    };
    if (!searchSettings([section], query).length) return [];
    return [{ item, section, source }];
  });
  const groups = groupByCategory(entries, (entry) => entry.section.category, categoryTitle);
  const current = location.pathname === undefined ? undefined : normalizePath(location.pathname);
  const { Link } = location;
  return (
    <nav aria-label={messages('navigation')} className="flex min-w-0 flex-col">
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          <SidebarGroupLabel asChild>
            <h2>{group.title}</h2>
          </SidebarGroupLabel>
          <PluginSlot
            name="app-preferences.navigation.group.before"
            payload={{ groupId: group.id }}
          />
          <SidebarMenu>
            {group.items.map(({ item, source }) => {
              // A SettingsRoute can be mounted under an explicit base path. Other destinations keep their URL.
              const href = source
                ? withQuery(sectionHref(location.basePath, source), query)
                : item.action.href!;
              const active = normalizePath(href) === current;
              const Icon = iconOf(item.action.icon);
              const props = item.action.linkProps({ href, onExecuted: onNavigate });
              const EntryLink = props.href ? Link : 'a';
              return (
                <SidebarMenuItem key={item.key}>
                  <Button
                    asChild
                    variant={active ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <EntryLink {...props} aria-current={active ? 'page' : undefined}>
                      {Icon && <Icon aria-hidden="true" data-icon="inline-start" />}
                      <span className="truncate">{item.action.title}</span>
                    </EntryLink>
                  </Button>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          <PluginSlot
            name="app-preferences.navigation.group.after"
            payload={{ groupId: group.id }}
          />
        </SidebarGroup>
      ))}
      {!groups.length && !view.pending && (
        <p role="status" className="px-4 text-sm text-muted-foreground">
          {messages('noResults')}
        </p>
      )}
    </nav>
  );
}
