'use client';
import { useContext, type ElementType } from 'react';
import { UIContext } from '../providers/action-context.js';
import { useActionGroups } from '../hooks/use-action-group.js';
import { Action } from './action.js';
import { Button } from './primitives/button.js';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from './primitives/sidebar.js';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from './primitives/navigation-menu.js';

export type ActionNavigationProps = {
  groups?: readonly string[];
  pathname?: string;
  linkComponent?: ElementType;
  /** Accessible name of the navigation landmark. */
  label?: string;
};

/** Render current Action groups in the standard sidebar without copying their state. */
export function ActionSidebarNavigation(props: ActionNavigationProps) {
  return <Navigation {...props} horizontal={false} />;
}
/** Render the same Action groups as a standard horizontal navigation menu. */
export function ActionNavigationMenu(props: ActionNavigationProps) {
  return <Navigation {...props} horizontal />;
}

function Navigation({
  groups = ['navigation'],
  horizontal,
  pathname,
  linkComponent,
  label = 'Navigation',
}: ActionNavigationProps & { horizontal: boolean }) {
  const navigation = useContext(UIContext);
  const bound = useActionGroups(groups);
  pathname ??= navigation.pathname ?? '';
  const LinkComponent: ElementType = linkComponent ?? navigation.Link ?? 'a';
  if (horizontal)
    return (
      <NavigationMenu aria-label={label} className="min-w-0 max-w-full justify-start">
        <NavigationMenuList className="flex-wrap justify-start gap-1">
          {bound.map((group) => (
            <NavigationMenuItem key={group.id}>
              <NavigationMenuTrigger>{group.title}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-64 max-w-[calc(100vw-3rem)] gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <NavigationMenuLink asChild active={item.href === pathname}>
                          <Action
                            id={item.id}
                            input={undefined}
                            kind={item.href !== undefined ? 'link' : 'button'}
                          >
                            {item.href !== undefined ? (
                              <LinkComponent>
                                {Icon && <Icon aria-hidden="true" />}
                                <span className="truncate">{item.title}</span>
                              </LinkComponent>
                            ) : (
                              <button type="button" className="w-full text-left">
                                <span className="truncate">{item.title}</span>
                              </button>
                            )}
                          </Action>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    );
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col">
      {bound.map((group) => (
        <SidebarGroup key={group.id}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.id}>
                  <Button
                    asChild
                    className="w-full justify-start"
                    variant={item.href === pathname ? 'secondary' : 'ghost'}
                  >
                    <Action id={item.id} kind={item.href !== undefined ? 'link' : 'button'}>
                      {item.href !== undefined ? (
                        <LinkComponent>
                          {Icon && <Icon aria-hidden="true" />}
                          <span>{item.title}</span>
                        </LinkComponent>
                      ) : (
                        <button type="button" />
                      )}
                    </Action>
                  </Button>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}
