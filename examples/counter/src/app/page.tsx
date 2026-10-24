'use client';
import Link from 'next/link';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader title="Counter example" subtitle="The smallest BitaKit feature." />
      <Link href="/counter">Open the Counter</Link>
    </>
  );
}
