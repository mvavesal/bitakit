'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Dashboard example"
        subtitle="One page, three plugins: each adds its own card through a slot."
      />
      <ActionLink action="dashboard.open" />
    </>
  );
}
