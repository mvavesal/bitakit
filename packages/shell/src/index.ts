'use client';
export { SettingsShell } from './settings/shell.js';
export { SettingsOverview } from './settings/overview.js';
export { ShellSettings } from './settings/layout.js';
export { shellLayout, shellTheme, shellPreferences } from './settings/appearance.js';
export {
  shellRenderers,
  ThemeCards,
  LayoutCards,
  AppearanceSection,
} from './settings/renderers.js';
export { SettingsPage } from './settings/page.js';
export { PluginSettingsOverview } from './settings/overview.js';
export { settingsCategories } from './settings/categories.js';
export { shellPlugin, type ShellOptions } from './plugin.js';
export { shellService } from './services/shell.js';
export { AppShell, useShellLayout } from './components/app-shell.js';

export { themePreferences } from './settings/theme.js';
export {
  verticalLayout,
  horizontalLayout,
  type ShellLayout,
  type ShellLayouts,
  type ShellLayoutProps,
} from './layouts/defaults.js';
export type { AppShellProps } from './components/app-shell.js';

export { notificationPreferences, type NotificationPlacement } from './settings/notifications.js';

export {
  notificationService,
  type NotificationId,
  type NotificationService,
  type NotificationOptions,
} from './services/notifications.js';

export type { NotificationLayout } from './providers/notifications.js';
