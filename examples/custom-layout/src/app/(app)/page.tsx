'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Custom layout example"
        subtitle="The app draws its own frame in src/layouts/app.tsx; plugins still fill it."
      />
      <ActionLink action="handbook.open" />
    </>
  );
}
