import type { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

/** Shared navigation chrome; page-specific controls stay with the page content. */
export function AppBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-2 sm:px-3">
      <SidebarTrigger size="icon" />
      {children && (
        <>
          <Separator
            orientation="vertical"
            className="data-vertical:h-5 data-vertical:self-center"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm">{children}</div>
        </>
      )}
    </header>
  );
}
