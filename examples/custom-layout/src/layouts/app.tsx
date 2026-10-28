'use client';
import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';
import { PluginSlot, useNavigation } from '@bitakit/ui';
import {
  AppBar,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '@bitakit/ui/components';

/**
 * The frame of every normal page (the part `layout.app`), replacing Shell's sidebar: one bar
 * with the brand, the navigation and the header widgets, then Shell's page surface and footer.
 * It renders the same slots as Shell, so plugins that fill them keep working unchanged.
 */
export default function AppFrame({ children }: { children?: ReactNode }) {
  const { items, isActive } = useNavigation();
  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col">
      {/* AppBar renders the app-bar.end slot itself. */}
      <AppBar
        left={<PluginSlot name="shell.brand" />}
        center={
          <NavigationMenu viewport={false} aria-label="Main navigation">
            <NavigationMenuList className="gap-1">
              {items.map((item) => (
                <NavigationMenuItem key={item.key}>
                  <AppShell.NavigationItem
                    item={item}
                    active={isActive(item.href)}
                    layout="navbar"
                  />
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        }
        right={<PluginSlot name="shell.header.end" />}
      />
      {/* The standard page spacing, with shell.content.before and .after around the page. */}
      <AppShell.Surface>{children}</AppShell.Surface>
      <AppShell.Footer />
    </div>
  );
}
