'use client';
import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';
import { PluginSlot, useSlot } from '@bitakit/ui';

/**
 * The frame of every page: Shell's sidebar and content, plus the `aside` slot in a column on
 * the right that stays in place while the page scrolls (a bar at the bottom on small screens).
 */
export default function AppFrame({ children }: { children?: ReactNode }) {
  const aside = useSlot('aside');
  return (
    <>
      <AppShell.Sidebar />
      <AppShell.Content topBar={<AppShell.TopBar />}>{children}</AppShell.Content>
      {aside.items.length > 0 && (
        <aside className="fixed inset-x-0 bottom-0 z-20 max-h-[40vh] overflow-y-auto border-t bg-background lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:max-h-none lg:w-[28rem] lg:shrink-0 lg:border-t-0 lg:border-l">
          <PluginSlot name="aside" />
        </aside>
      )}
    </>
  );
}
