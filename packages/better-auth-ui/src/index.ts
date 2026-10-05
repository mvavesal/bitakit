'use client';
export * from '@better-auth-ui/heroui';
export { AuthPageLayout } from './auth-page-layout.js';
export { AuthProvider as BetterAuthUIProvider } from '@better-auth-ui/heroui';
export { Organization } from '@better-auth-ui/heroui/plugins/organization';
export { betterAuthUIPlugin, betterAuthUIService } from './plugin.js';
export type { BetterAuthUIConfiguration, BetterAuthUIOptions } from './plugin.js';
export { AccountSettingsPage, type AccountSettingsPageProps } from './settings/account.js';
export { createBetterAuthIntegration, type BetterAuthIntegrationOptions } from './integration.js';

export { AccountProfileSettings, AccountSecuritySettings } from './settings/account.js';
