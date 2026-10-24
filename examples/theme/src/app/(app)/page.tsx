'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <>
      <PageHeader title="Theme example" subtitle="Two app themes from JSON files in src/themes/." />
      <ActionLink action="gallery.open" />
    </>
  );
}
