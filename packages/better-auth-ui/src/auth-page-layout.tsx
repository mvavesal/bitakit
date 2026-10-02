'use client';
import { useTranslation } from '@bitakit/ui';
import type { ReactNode } from 'react';
import { useAuth, useSession } from '@better-auth-ui/react';
import { safeHref } from '@bitakit/core';
import { BackLink } from './components/ui/index.js';

/** Real authentication entry, independent of a host's component showcase. */
export function AuthPageLayout({ children }: { children: ReactNode }) {
  const translateUI = useTranslation();
  const { redirectTo, authClient } = useAuth();
  const { data: session } = useSession(authClient);
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-6">
      {session?.user && (
        <BackLink href={safeHref(redirectTo) ?? '/'}>
          {translateUI(
            'foundationUI.auth_page_layout.backToApplication',
            undefined,
            'Back to application',
          )}
        </BackLink>
      )}
      {children}
    </main>
  );
}
