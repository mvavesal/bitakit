'use client';
import { createElement, type ComponentType, type ReactNode } from 'react';
import {
  definePlugin,
  defineService,
  defineSettings,
  serviceKey,
  type PluginPageDefinition,
} from '@bitakit/core';
import { useTranslation } from '@bitakit/ui';
import { resolveAuthConfig } from '@better-auth-ui/core';
import { AuthProvider, Auth, Settings, type AuthProviderProps } from '@better-auth-ui/heroui';
import { Organization } from '@better-auth-ui/heroui/plugins/organization';
import { Toast } from '@heroui/react';
import UserIcon from 'reicon-react/icons/User';
import { AccountSettingsPage } from './settings/account.js';

/** Full native configuration, never a reduced copy of its auth options. */
export type BetterAuthUIConfiguration = Omit<AuthProviderProps, 'children'>;
export const betterAuthUIService = serviceKey<BetterAuthUIConfiguration>('better-auth-ui');
export type BetterAuthUIOptions = {
  provider: BetterAuthUIConfiguration;
  /** Disable when the host already owns the shared HeroUI toast surface (for example Shell). */
  toastProvider?: boolean;
  /** Local demo content shown as the account profile while nobody is signed in. */
  profileFallback?: ComponentType;
  /** False for hosts that render exported components with their own router. */
  pages?: boolean;
  pageLayout?: ComponentType<{ children: ReactNode }>;
  /** Separate authentication pages from optional demo/catalog layouts. */
  authPageLayout?: ComponentType<{ children: ReactNode }>;
};

/** Ordinary Foundation plugin. Uses the host's existing Better Auth client/session. */
export function betterAuthUIPlugin(options: BetterAuthUIOptions) {
  const config = resolveAuthConfig(options.provider);
  const pages: PluginPageDefinition[] = [];
  const Layout = options.pageLayout;
  const addPage = (path: string, render: () => ReactNode, PageLayout = Layout) => {
    if (pages.some((page) => page.path === path)) return;
    pages.push({
      path,
      component: () => (PageLayout ? createElement(PageLayout, null, render()) : render()),
    });
  };
  const paths = (kind: 'auth' | 'settings' | 'organization') => {
    const builtIn = kind === 'organization' ? {} : config.viewPaths[kind];
    return [
      ...new Set(
        Object.values({
          ...builtIn,
          ...Object.assign({}, ...config.plugins.map((plugin) => plugin.viewPaths?.[kind])),
        }) as string[],
      ),
    ];
  };
  if (options.pages !== false) {
    for (const path of paths('auth'))
      addPage(
        `${config.basePaths.auth}/${path}`,
        () => <Auth path={path} />,
        options.authPageLayout ?? Layout,
      );
    for (const path of paths('settings'))
      addPage(`${config.basePaths.settings}/${path}`, () => <Settings path={path} />);
    if (config.plugins.some((plugin) => plugin.id === 'organization')) {
      for (const path of paths('organization'))
        addPage(`${config.basePaths.organization}/${path}`, () => <Organization path={path} />);
      for (const plugin of options.provider.plugins ?? []) {
        for (const tab of plugin.organizationTabs ?? []) {
          addPage(`${config.basePaths.organization}/${tab.path}`, () => (
            <Organization path={tab.path} />
          ));
        }
      }
    }
  }
  function Provider({ children }: { children: ReactNode }) {
    const t = useTranslation();
    const catalog = t.getCatalog('betterAuth');
    const locale = catalog as unknown as BetterAuthUIConfiguration['locale'];
    return (
      <AuthProvider {...options.provider} locale={locale ?? options.provider.locale}>
        {children}
        {options.toastProvider !== false && <Toast.Provider />}
      </AuthProvider>
    );
  }
  function AccountSettings() {
    return <AccountSettingsPage profileFallback={options.profileFallback} />;
  }
  return definePlugin({
    id: 'better-auth-ui',
    metadata: {
      name: 'Better Auth UI',
      version: '0.1.0',
      description: 'Native HeroUI components for sign-in, accounts and organizations.',
      homepage: 'https://better-auth-ui.com',
      license: 'MIT',
    },
    // The contract key equals the plugin ID, so the service is an array entry: a record key
    // would make the ID `better-auth-ui.<key>`, a namespace the contract name cannot share.
    services: [defineService(() => options.provider, { provides: betterAuthUIService })],
    settings: defineSettings(
      {},
      {
        title: 'Account',
        description:
          'Profile, email, password, two-factor authentication, linked accounts and active sessions.',
        icon: UserIcon,
        category: 'account',
        order: 0,
        path: 'account',
      },
    ),
    ui: {
      providers: [{ id: 'better-auth-ui', component: Provider }],
      pages,
      settings: { component: AccountSettings },
    },
  });
}
