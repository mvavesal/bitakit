import type { ReactNode } from 'react';

// A variant of the `auth` family: a brand panel next to the form on wide screens.
// As the app's own file it replaces Shell's default auth layout; no registration.
export default function AuthSplitLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden flex-col justify-end bg-primary p-10 text-primary-foreground lg:flex">
        <p className="text-2xl font-semibold">Layouts example</p>
        <p>This panel comes from src/layouts/auth/split.tsx.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
