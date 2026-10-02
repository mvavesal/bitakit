'use client';
import { useContext, type ReactNode, type ElementType } from 'react';
import { useSetting } from '@bitakit/app-preferences';
import { ShellContext } from '../providers/shell-context.js';
import { SidebarProvider, SidebarInset, TooltipProvider } from '@bitakit/ui/components';
import { verticalLayout, horizontalLayout, type ShellLayouts } from '../layouts/defaults.js';

/** Read the persisted layout from App Preferences, the sole selection owner. */
export function useShellLayout() {
  return useSetting(useContext(ShellContext).layout).value;
}

export type AppShellProps = {
  children: ReactNode;
  brand?: ReactNode;
  account?: ReactNode;
  header?: ReactNode;
  groups?: readonly string[];
  pathname?: string;
  linkComponent?: ElementType;
  /** Override either fixed variant; omitted variants retain their standard composition. */
  layouts?: ShellLayouts;
};

/** Switch surrounding layout components while keeping the content subtree at a stable position. */
export function AppShell({ children, layouts, ...props }: AppShellProps) {
  const selected = useShellLayout();
  const { groups } = useContext(ShellContext);
  const horizontal = selected === 'navbar';
  const { Navigation, Header } =
    layouts?.[selected] ?? (horizontal ? horizontalLayout : verticalLayout);
  return (
    <TooltipProvider>
      <SidebarProvider data-shell-layout={selected} className={horizontal ? 'flex-col' : undefined}>
        <Navigation groups={groups} {...props} />
        <SidebarInset className="min-w-0">
          {Header ? <Header {...props} /> : null}
          <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
