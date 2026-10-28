'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Custom settings example"
        subtitle="Validated settings, a custom settings page and server storage in SQLite."
      />
      <ActionLink action="profile.open" />
    </>
  );
}
