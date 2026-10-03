'use client';
import { createBetterAuthIntegration } from '@bitakit/better-auth-ui';
import { WorkspaceLayout } from './components/workspace-layout';

export function createContentAuth(
  navigate: (options: { to: string; replace?: boolean }) => void,
  preview = false,
) {
  return createBetterAuthIntegration({
    toastProvider: false,
    organizations: { path: false, groups: [] },
    provider: {
      navigate,
      redirectTo: '/',
      basePaths: {
        auth: '/better-auth/auth',
        settings: '/better-auth/settings',
        organization: '/better-auth/organization',
      },
      socialProviders: preview ? [] : ['google', 'github'],
      multipleAccountsPerProvider: false,
      emailAndPassword: { forgotPassword: !preview, confirmPassword: true },
    },
    pageLayout: WorkspaceLayout,
  });
}
