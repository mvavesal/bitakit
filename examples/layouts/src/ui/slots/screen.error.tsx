'use client';
import type { SlotProps } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@bitakit/shell/pages';

// Replaces Shell's error screen; `reset` retries when the framework offers it.
// Never show the raw error: it can contain server details.
export default function ErrorScreen({ payload }: SlotProps<'screen.error'>) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>That did not work</EmptyTitle>
        <EmptyDescription>Try again in a moment.</EmptyDescription>
      </EmptyHeader>
      {payload.reset && (
        <EmptyContent>
          <Button onClick={payload.reset}>Try again</Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
