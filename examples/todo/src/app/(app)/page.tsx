'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader title="Todo example" subtitle="One plugin with a service and five Actions." />
      <ActionLink action="todos.open" />
    </>
  );
}
