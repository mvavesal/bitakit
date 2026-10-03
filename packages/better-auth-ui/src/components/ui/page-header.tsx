import type { ReactNode } from 'react';
import { cn } from 'cn';

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** 1 for a page title; 2 for a part of a page that a host frame already titles. */
  level?: 1 | 2;
  className?: string;
};

export function PageHeader({ title, subtitle, trailing, level = 1, className }: PageHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h1';
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Heading className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
          {title}
        </Heading>
        {subtitle != null && (
          <div className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</div>
        )}
      </div>
      {trailing != null && (
        <div className="flex max-w-full flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0 sm:justify-end">
          {trailing}
        </div>
      )}
    </header>
  );
}
