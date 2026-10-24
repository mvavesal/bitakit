'use client';
import { useState } from 'react';
import { Button, PageHeader } from '@bitakit/ui/components';

// Throws while rendering after the click, so the app's error screen takes over.
export default function CrashPage() {
  const [broken, setBroken] = useState(false);
  if (broken) throw new Error('Demo failure');
  return (
    <>
      <PageHeader title="Error screen demo" subtitle="The button breaks this page on purpose." />
      <Button variant="destructive" onClick={() => setBroken(true)}>
        Break this page
      </Button>
    </>
  );
}
