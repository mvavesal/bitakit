'use client';
import { useCallback, useContext, type ElementType } from 'react';
import { UIContext } from '../providers/action-context.js';
import { useFoundation } from '../providers/foundation-context.js';
import { ActionButton } from './action-button.js';
import { ActionLink } from './action-link.js';
import { ActionGroupBinding, type ActionGroupsViewProps } from './action-group-binding.js';
import { Button } from './primitives/button.js';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from './primitives/sidebar.js';
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from './primitives/navigation-menu.js';

export type ActionNavigationProps = {
  groups?: readonly string[];
  pathname?: string;
  linkComponent?: ElementType;
};

/** Render current Action groups in the standard sidebar without copying their state. */
export function ActionSidebarNavigation({ groups = ['navigation'], pathname, linkComponent }: ActionNavigationProps) {
  return <Navigation groups={groups} pathname={pathname} linkComponent={linkComponent} horizontal={false} />;
}

/** Render the same Action groups as a standard horizontal navigation menu. */
export function ActionNavigationMenu({ groups = ['navigation'], pathname, linkComponent }: ActionNavigationProps) {
  return <Navigation groups={groups} pathname={pathname} linkComponent={linkComponent} horizontal />;
}

/** Bind navigation to the existing root ActionList and preserve native URL semantics. */
function Navigation({
  groups,
  horizontal,
  pathname,
  linkComponent,
}: {
  groups: readonly string[];
  horizontal: boolean;
  pathname?: string;
  linkComponent?: ElementType;
}) {
  const { runtime } = useFoundation();
  const navigation = useContext(UIContext);
  pathname ??= navigation.pathname ?? '';
  linkComponent ??= navigation.Link ?? 'a';
  const render = useCallback(
    ({ groups: resolved }: ActionGroupsViewProps) =>
      horizontal ? (
        <NavigationMenu aria-label="Kategorien" className="min-w-0 max-w-full justify-start">
          <NavigationMenuList className="flex-wrap justify-start gap-1">
            {resolved
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <NavigationMenuItem key={group.id}>
                  <NavigationMenuTrigger>{group.title ?? (group.id === 'navigation' ? 'Allgemein' : group.id)}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-64 max-w-[calc(100vw-3rem)] gap-1">
                      {group.items.map((action) => (
                        <li key={action.id}>
                          <NavigationMenuLink asChild active={action.href === pathname}>
                            {action.href ? (
                              <ActionLink action={action.id} as={linkComponent}>
                                {action.icon && <action.icon aria-hidden="true" />}
                                <span className="truncate">{action.title}</span>
                              </ActionLink>
                            ) : (
                              <ActionButton
                                action={action.id}
                                as="button"
                                type="button"
                                className="w-full text-left"
                              >
                                <span className="truncate">{action.title}</span>
                              </ActionButton>
                            )}
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
          </NavigationMenuList>
        </NavigationMenu>
      ) : (
        <div className="flex min-w-0 flex-col">
          {resolved.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.title ?? (group.id === 'navigation' ? 'Allgemein' : group.id)}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((action) => (
                  <SidebarMenuItem key={action.id}>
                    <Button asChild className="w-full justify-start" variant={action.href === pathname ? 'secondary' : 'ghost'}>
                      {action.href ? (
                        <ActionLink action={action.id} as={linkComponent}>
                          {action.icon && <action.icon aria-hidden="true" />}
                          <span>{action.title}</span>
                        </ActionLink>
                      ) : (
                        <ActionButton action={action.id} />
                      )}
                    </Button>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </div>
      ),
    [horizontal, pathname, linkComponent],
  );
  return (
    <ActionGroupBinding
      groups={groups.map((id) => runtime.getGroup(id))}
      context={undefined}
      as={render}
    />
  );
}
