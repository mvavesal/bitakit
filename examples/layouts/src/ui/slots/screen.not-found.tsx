'use client';
import { Button } from '@bitakit/ui/components';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@bitakit/shell/pages';

// Replaces Shell's not-found screen everywhere it appears: unknown plugin paths and not-found.tsx.
export default function NotFoundScreen() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nothing here</EmptyTitle>
        <EmptyDescription>The page moved or never existed.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <a href="/">Go to the start page</a>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
