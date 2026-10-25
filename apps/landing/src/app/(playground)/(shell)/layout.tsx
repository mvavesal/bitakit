'use client';
import type { ReactNode } from 'react';
import { AppShell, type NavigationItemProps } from '@bitakit/shell';

/** Settings stays in normal horizontal navigation; the sidebar already owns its footer link. */
function NavigationItem(props: NavigationItemProps) {
  if (props.layout === 'sidebar' && props.item.id === 'app-preferences.settings') return null;
  return <AppShell.NavigationItem {...props} />;
}

const components = { NavigationItem };

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell components={components}>{children}</AppShell>;
}
