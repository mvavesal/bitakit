import type { ReactNode } from 'react';

// A new family: any page that exports `layout = 'onboarding'` renders inside this frame.
// Discovery declares the family `layout.onboarding` from this file name.
export default function OnboardingLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-10">
      <p className="text-sm text-muted-foreground">Step 1 of 3 · Onboarding layout</p>
      {children}
    </div>
  );
}
