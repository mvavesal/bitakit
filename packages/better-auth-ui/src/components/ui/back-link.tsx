import type { ElementType, ReactNode } from 'react';
import ArrowLeftIcon from 'reicon-react/icons/ArrowLeft';
import { Button } from './button.js';
import { cn } from 'cn';

/** Explicit parent navigation, safe for direct page loads and host routers. */
export function BackLink({
  href,
  children,
  as: Link = 'a',
  className,
}: {
  href: string;
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn('w-fit justify-start', className)}>
      <Link href={href}>
        <ArrowLeftIcon aria-hidden="true" />
        {children}
      </Link>
    </Button>
  );
}
