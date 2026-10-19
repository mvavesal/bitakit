'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createBetterAuthIntegration } from '@bitakit/better-auth-ui';
import { BitaKitProvider } from '../bitakit.gen';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authentication] = useState(() =>
    createBetterAuthIntegration({
      toastProvider: false,
      organizations: { path: false, groups: [] },
      provider: {
        navigate: ({ to, replace }) => (replace ? router.replace(to) : router.push(to)),
        redirectTo: '/todos',
        socialProviders: [],
        basePaths: { auth: '/auth', settings: '/account', organization: '/organization' },
        emailAndPassword: { forgotPassword: false },
      },
    }),
  );
  return <BitaKitProvider additionalPlugins={authentication.plugins}>{children}</BitaKitProvider>;
}
