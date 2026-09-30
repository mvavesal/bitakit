'use client';
import type { ComponentProps, ReactNode } from 'react';
import ChevronExpandYIcon from 'reicon-react/icons/ChevronExpandY';
import { SidebarMenuButton } from '@bitakit/shell/sidebar';
/** Shared account/workspace trigger, matching the original sidebar interaction. */
export function SidebarIdentity({
  avatar,
  name,
  description,
  ...props
}: Omit<ComponentProps<typeof SidebarMenuButton>, 'children'> & {
  avatar: ReactNode;
  name: string;
  description?: string;
}) {
  return (
    <SidebarMenuButton size="lg" {...props}>
      {avatar}
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        {description && (
          <span className="truncate text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      <ChevronExpandYIcon
        data-slot="identity-chevron"
        className="ml-auto opacity-0 transition-opacity group-hover/menu-button:opacity-100 group-focus-visible/menu-button:opacity-100 group-data-[state=open]/menu-button:opacity-100"
        aria-hidden="true"
      />
    </SidebarMenuButton>
  );
}
