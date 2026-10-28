'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Bookmarks example"
        subtitle="Load and save through an API route, with SQLite on the server."
      />
      <ActionLink action="bookmarks.open" />
    </>
  );
}
