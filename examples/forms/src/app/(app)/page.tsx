'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Forms example"
        subtitle="A dialog Action, react-hook-form and one zod schema from browser to SQLite."
      />
      <ActionLink action="tickets.open" />
    </>
  );
}
