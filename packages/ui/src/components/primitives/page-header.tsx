import type { ReactNode } from 'react';
import { cn } from 'cn';

export type PageHeaderProps = {
  title: ReactNode;
  /** Navigation or context above the title, for example a back link. */
  before?: ReactNode;
  titleId?: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** Page title with optional subtitle and trailing actions; wraps long titles on narrow screens. */
export function PageHeader({
  title,
  subtitle,
  trailing,
  className,
  before,
  titleId,
}: PageHeaderProps) {
  return (
    <header className={cn('flex shrink-0 flex-col gap-4', className)}>
      {before != null && <div>{before}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* The title keeps a readable width; many trailing controls wrap instead of squeezing it. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-48">
          <h1
            id={titleId}
            className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]"
          >
            {title}
          </h1>
          {subtitle != null && (
            <div className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</div>
          )}
        </div>
        {trailing != null && (
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
            {trailing}
          </div>
        )}
      </div>
    </header>
  );
}
