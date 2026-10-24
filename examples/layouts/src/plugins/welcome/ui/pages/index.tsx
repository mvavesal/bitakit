'use client';
import { Button, PageHeader } from '@bitakit/ui/components';

// A page of the app's own `onboarding` family (src/layouts/onboarding.tsx).
export const layout = 'onboarding';

export default function WelcomePage() {
  return (
    <>
      <PageHeader title="Welcome aboard" subtitle="No sidebar, no header: the onboarding frame." />
      <Button asChild>
        <a href="/">Finish</a>
      </Button>
    </>
  );
}
