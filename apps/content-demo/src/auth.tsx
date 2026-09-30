'use client';
import type { AppPreferences } from '@bitakit/app-preferences/core';
import { createBetterAuthIntegration } from '@bitakit/better-auth-ui';
import { WorkspaceLayout } from './components/workspace-layout';

export function createContentAuth(
  settings: AppPreferences,
  navigate: (options: { to: string; replace?: boolean }) => void,
) {
  return createBetterAuthIntegration({
    toastProvider: false,
    accountSettings: { catalog: settings },
    organizations: { path: false, groups: [] },
    provider: {
      navigate,
      redirectTo: '/',
      basePaths: {
        auth: '/better-auth/auth',
        settings: '/better-auth/settings',
        organization: '/better-auth/organization',
      },
      socialProviders: ['google', 'github'],
      multipleAccountsPerProvider: false,
      emailAndPassword: { forgotPassword: true, confirmPassword: true },
    },
    pageLayout: WorkspaceLayout,
  });
}
