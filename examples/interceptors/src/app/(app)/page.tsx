'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader
        title="Interceptors example"
        subtitle="One plugin owns customers; two others watch and gate it from their own folders."
      />
      <ActionLink action="customers.open" />
    </>
  );
}
