'use client';
/**
 * Custom layouts for the Shell. AppLogo and AccountMenu stand for application-owned
 * components. Use a layout from a client layout file, for example `src/layouts/focus.tsx`,
 * which plugin pages select with `export const layout = 'focus'`.
 */
import type { ReactNode } from 'react';
import { Action, useNavigation, useSlot, type SlotView } from '@bitakit/ui';
import { AppBar } from '@bitakit/ui/components';
import { AppShell } from '@bitakit/shell';

declare function AppLogo(): ReactNode;
declare function AccountMenu(): ReactNode;

/** Compound parts: the Shell sidebar and content area, without a top bar. */
export function FocusLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <AppShell.Sidebar header={<AppLogo />} footer={<AccountMenu />} />
      <AppShell.Content>{children}</AppShell.Content>
    </AppShell>
  );
}

const contributions = (view: SlotView) =>
  view.items.map(entry => entry.kind === 'component'
    ? <entry.component key={entry.key} payload={view.payload} /> : null);

/** Hooks only: every navigation action and slot contribution in the app's own arrangement. */
export function MinimalLayout({ children }: { children: ReactNode }) {
  const { items, isActive } = useNavigation();
  const header = useSlot('sidebar.header', { payload: { collapsed: false } });
  const footer = useSlot('sidebar.footer', { payload: { collapsed: false } });
  return (
    <>
      {/* AppBar renders the app-bar.end slot itself. */}
      <AppBar
        left={
          <>
            <AppLogo />
            {contributions(header)}
          </>
        }
        center={
          <nav aria-label="Main navigation">
            {items.map((item) => (
                // An empty child receives the action's icon and title.
                <Action key={item.key} id={item}>
                  {item.href === undefined ? (
                    <button type="button" />
                  ) : (
                    <a aria-current={isActive(item.href) ? 'page' : undefined} />
                  )}
                </Action>
              ))}
          </nav>
        }
        right={contributions(footer)}
      />
      <main>{children}</main>
    </>
  );
}
