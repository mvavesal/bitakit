'use client';
import { createElement, type ComponentType, type ReactNode } from 'react';
import {
  definePlugin,
  provideService,
  serviceKey,
  type PluginPageDefinition,
} from '@bitakit/core';
import { useTranslation } from '@bitakit/ui';
import { SettingsSection, type AppPreferences } from '@bitakit/app-preferences/core';
import { resolveAuthConfig, type SettingsView } from '@better-auth-ui/core';
import { AuthProvider, Auth, Settings, type AuthProviderProps } from '@better-auth-ui/heroui';
import { Organization } from '@better-auth-ui/heroui/plugins/organization';
import { accountSettingsSections, type AccountSettingsOptions } from './settings/account.js';
import { Toast } from '@heroui/react';

/** Full native configuration, never a reduced copy of its auth options. */
export type BetterAuthUIConfiguration = Omit<AuthProviderProps, 'children'>;
export const betterAuthUIService = serviceKey<BetterAuthUIConfiguration>('better-auth-ui');
export type BetterAuthUIOptions = {
  provider: BetterAuthUIConfiguration;
  /** Disable when the host already owns the shared HeroUI toast surface (for example Shell). */
  toastProvider?: boolean;
  /** Native account pages owned and registered by this plugin. */
  accountSettings?: AccountSettingsOptions;
  /** False for hosts that render exported components with their own router. */
  pages?: boolean;
  pageLayout?: ComponentType<{ children: ReactNode }>;
  /** Separate authentication pages from optional demo/catalog layouts. */
  authPageLayout?: ComponentType<{ children: ReactNode }>;
  /** Explicit opt-in: prevents duplicate organization/account settings ownership. */
  settings?: {
    catalog: AppPreferences;
    section: string;
    entries: readonly { id: string; title: string; view: SettingsView }[];
  };
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
      addPage(`${config.basePaths.auth}/${path}`, () => <Auth path={path} />, options.authPageLayout ?? Layout);
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
  for (const entry of options.settings?.entries ?? []) {
    addPage(`/settings/${entry.id}`, () => <Settings view={entry.view} hideNav />);
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
  return definePlugin({
    id: 'better-auth-ui',
    metadata: {
      name: 'Better Auth UI',
      version: '0.1.0',
      description: 'Original HeroUI-Komponenten für Anmeldung, Konto und Organisationen.',
      homepage: 'https://better-auth-ui.com',
      license: 'MIT',
    },
    providers: [{ id: 'better-auth-ui', component: Provider }],
    services: [provideService(betterAuthUIService, { create: () => options.provider })],
    pages,
    setup({ app }) {
      if (options.accountSettings) {
        for (const section of accountSettingsSections(options.accountSettings)) {
          app.own(options.accountSettings.catalog.add(section).remove);
        }
      }
      for (const entry of options.settings?.entries ?? []) {
        const registration = options.settings!.catalog.add(
          new SettingsSection({
            id: entry.id,
            title: entry.title,
            pluginId: 'better-auth-ui',
            showHeader: false,
            component: () => <Settings view={entry.view} hideNav />,
          }),
          { section: options.settings!.section },
        );
        app.own(() => registration.remove());
      }
    },
  });
}
