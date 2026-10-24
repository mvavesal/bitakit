'use client';
import { ActionLink, useSetting } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  const company = useSetting('companyName').value;
  return (
    <>
      <PageHeader title="Settings example" subtitle={`Welcome to ${company}.`} />
      <ActionLink action="greeting.open" />
    </>
  );
}
