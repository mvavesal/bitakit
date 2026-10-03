import type { ElementType, ReactNode } from 'react';
import ArrowLeftIcon from 'reicon-react/icons/ArrowLeft';
import { Button } from '@bitakit/ui/components';

/** Explicit parent navigation; safe for direct page loads and every host router. */
export function BackLink({
  href,
  children,
  as: Link = 'a',
}: {
  href: string;
  children: ReactNode;
  as?: ElementType;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className="w-fit justify-start">
      <Link href={href}>
        <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
        {children}
      </Link>
    </Button>
  );
}
