'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Actions example"
        subtitle="Every option of defineAction on one page, with the file that shows it."
      />
      <ActionLink action="playground.open" />
    </>
  );
}
