'use client';
import type { NotificationLayout } from './providers/notifications.js';
import {
  definePlugin,
  provideService,
  getService,
  type ServiceDefinition,
  type LegacyServiceDefinition,
} from '@bitakit/core';
import {
  AppPreferences,
  defineSettingsSection,
  SelectSetting,
  type SectionOptions,
  type SettingsSource,
  SettingsSection,
} from '@bitakit/app-preferences/core';
import { settingsService } from '@bitakit/app-preferences/foundation';
import { createShellProvider } from './providers/shell-context.js';
import LayoutIcon from 'reicon-react/icons/Layout';
import WidgetIcon from 'reicon-react/icons/Widget';
import PaletteIcon from 'reicon-react/icons/Palette';
import BellIcon from 'reicon-react/icons/Notification';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import { shellLayout, shellPreferences, shellTheme } from './settings/appearance.js';
import { PluginSettingsOverview } from './settings/overview.js';
import { bindPluginResults, pluginOverviewSection } from './settings/plugin-results.js';
import { settingsCategories } from './settings/categories.js';
import { SettingsPage } from './settings/page.js';
import { shellRenderers } from './settings/renderers.js';
import { themePreferences } from './settings/theme.js';
import { bindThemePreferences } from './theme/projection.js';
import {
  notificationService,
  translatedNotifications,
  type NotificationService,
} from './services/notifications.js';
import { createNotificationService } from './services/heroui-notifications.js';
import { notificationPreferences, type NotificationPlacement } from './settings/notifications.js';
import { shellService } from './services/shell.js';
/**
 * Shell contributes its preferences, sections and renderers declaratively; the Settings
 * integration (`appPreferencesPlugin`) installs them. Theme projection into the DOM stays in setup.
 */
export type ShellOptions = {
  settings?: AppPreferences;
  /** Own the shared HeroUI toast surface and its user preference. Disabled by default. */
  notifications?:
    | boolean
    | {
        placement?: NotificationPlacement;
        /** Native HeroUI renderer for every toast in the shared surface. */
        layout?: NotificationLayout;
        /** Replace the implementation using the normal Foundation service lifecycle. */
        service?: Omit<LegacyServiceDefinition<NotificationService>, 'id'>;
        /** False when an application-owned provider renders a custom service's notifications. */
        toastProvider?: boolean;
      };
  layout?: 'sidebar' | 'navbar';
  navigationGroups?: readonly string[];
  appearance?: boolean;
  /** Adds the Plugins settings page and publishes each plugin as a link to its view there. */
  pluginManagement?: boolean;
  settingsPath?: string;
  /** Legacy: registers the Shell page under an existing host section instead of contributing it. */
  settingsSection?: string;
  /** Host-defined navigation category; not a storage scope. */
  category?: SectionOptions['category'];
  theme?: SelectSetting<'light' | 'dark' | 'system'>;
  /** False when the host already projects the same theme setting into the DOM. */
  applyTheme?: boolean;
  groups?: readonly string[];
};
export function shellPlugin(options: ShellOptions = {}) {
  const layout = options.layout
    ? new SelectSetting({ ...shellLayout, defaultValue: options.layout })
    : shellLayout;
  const appearance = options.appearance ?? false;
  const notifications = options.notifications ?? false;
  const nativeNotifications =
    notifications && (typeof notifications !== 'object' || notifications.toastProvider !== false);
  const notificationDefinition =
    typeof notifications === 'object' && notifications.service
      ? notifications.service
      : {
          create: createNotificationService,
          dispose: (service: NotificationService) =>
            (service as ReturnType<typeof createNotificationService>).dispose(),
        };
  const notificationPlacement =
    typeof notifications === 'object' && notifications.placement
      ? new SelectSetting({
          ...notificationPreferences.fields.placement,
          defaultValue: notifications.placement,
        })
      : notificationPreferences.fields.placement;
  const path = options.settingsPath ?? (appearance ? '/settings/appearance' : '/settings/shell');
  const theme = options.theme ?? shellTheme;
  const data: SettingsSource[] = appearance
    ? options.theme
      ? [options.theme, layout]
      : options.layout
        ? [theme, layout]
        : [shellPreferences]
    : [layout];
  const page = new SettingsSection({
    id: appearance ? 'appearance' : 'shell',
    navigation: { id: 'shell.settings', groups: options.groups ?? ['navigation'] },
    path: path.split('/').pop(),
    category:
      options.category ??
      (appearance ? settingsCategories.appearance : { id: 'plugins', title: 'Plugins' }),
    title: appearance ? 'Layout and color scheme' : 'App Shell',
    description: appearance ? 'Customize color scheme and navigation.' : undefined,
    icon: WidgetIcon,
    settings: data,
  });
  const themePage = defineSettingsSection({
    id: 'shell-theme',
    path: 'theme',
    title: 'Theme',
    description: 'Customize colors, corners and surfaces.',
    category: options.category ?? settingsCategories.appearance,
    icon: PaletteIcon,
    settings: [themePreferences],
  });
  const sections = [
    ...(nativeNotifications
      ? [
          defineSettingsSection({
            id: 'shell-notifications',
            path: 'notifications',
            title: 'Benachrichtigungen',
            icon: BellIcon,
            category: options.category ?? settingsCategories.appearance,
            settings: [notificationPlacement],
          }),
        ]
      : []),
    ...(appearance ? [themePage] : []),
    ...(options.pluginManagement
      ? [
          defineSettingsSection({
            id: pluginOverviewSection,
            title: 'Plugins',
            icon: PuzzleIcon,
            category: settingsCategories.administration,
            component: PluginSettingsOverview,
            showHeader: false,
          }),
        ]
      : []),
    ...(options.settingsSection ? [] : [page]),
  ];
  const Page = () => <SettingsPage pathname={path} unavailable="This setting is unavailable." />;
  return definePlugin({
    id: 'shell',
    metadata: {
      icon: LayoutIcon,
      name: 'App Shell',
      description: 'Application navigation and layout.',
    },
    services: [
      ...(notifications
        ? [
            provideService(notificationService, {
              ...translatedNotifications(notificationDefinition),
              exposeAs: 'notifications',
            }),
          ]
        : []),
      provideService(shellService, {
        requires: options.settings ? [] : [settingsService],
        create: ({ services }) => ({
          settings: options.settings ?? getService(services, settingsService),
        }),
      }),
    ],
    providers: [
      {
        id: 'shell.ui',
        requires: ['settings.ui'],
        component: createShellProvider(
          layout,
          options.navigationGroups,
          notifications
            ? {
                placement: nativeNotifications ? notificationPlacement : undefined,
                layout: typeof notifications === 'object' ? notifications.layout : undefined,
              }
            : undefined,
        ),
      },
    ],
    pages: [
      { path, component: Page },
      ...(appearance
        ? [
            {
              path: '/settings/theme',
              component: () => (
                <SettingsPage
                  pathname="/settings/theme"
                  unavailable="This setting is unavailable."
                />
              ),
            },
          ]
        : []),
    ],
    contributions: {
      settings: [
        ...(appearance ? [...data, themePreferences] : data),
        ...(nativeNotifications ? [notificationPlacement] : []),
      ],
      'settings.sections': sections,
      'settings.renderers': [
        shellRenderers({
          appearance,
          theme,
          layout,
          notifications: nativeNotifications ? notificationPlacement : undefined,
        }),
      ],
    },
    setup({ app, services }) {
      const settings = options.settings ?? getService(services, settingsService);
      const parentId = options.settingsSection;
      if (appearance && options.applyTheme !== false && typeof document !== 'undefined') {
        app.own(bindThemePreferences(settings, document.documentElement));
      }
      if (options.pluginManagement) app.own(bindPluginResults(app, settings, services.i18n));
      if (parentId) {
        // Legacy parent grouping; shared parents belong to the host.
        if (!settings.getSection(parentId))
          throw new Error('Shell settings target section is not registered.');
        app.own(
          settings.add(new SettingsSection({ ...page, pluginId: 'shell' }), { section: parentId })
            .remove,
        );
      }
      if (appearance && options.applyTheme !== false && typeof window !== 'undefined') {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
          const state = settings.get(theme);
          if (!state.ready) return;
          const value = state.value;
          const dark = value === 'dark' || (value === 'system' && media.matches);
          document.documentElement.classList.toggle('dark', dark);
          document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        };
        const unsubscribe = settings.subscribe(theme, apply);
        media.addEventListener('change', apply);
        apply();
        app.own(() => {
          unsubscribe();
          media.removeEventListener('change', apply);
        });
      }
    },
  });
}
