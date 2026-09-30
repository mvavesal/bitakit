import type { ReactNode } from 'react';
import { cn } from 'cn';

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, trailing, className }: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
          {title}
        </h1>
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
