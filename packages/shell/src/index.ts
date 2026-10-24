'use client';
export {
  AppShell,
  useShellLayout,
  type AppShellProps,
  type AppShellComponents,
  type AppShellSidebarProps,
  type AppShellTopBarProps,
  type AppShellContentProps,
  type NavigationItemProps,
} from './components/app-shell.js';
export type { ShellLayout, NotificationPlacement } from './appearance.js';
export { useNotifications } from './ui/use-notifications.js';
export {
  notificationService,
  type NotificationId,
  type NotificationOptions,
  type NotificationService,
} from './services/notifications.js';
export { ShellThemeScript } from './ui/providers/theme.js';
export { shellPlugin } from './plugin.js';
export { shellOptions, type ShellOptions, type ShellPreset } from './options.js';
export {
  PageState,
  NotFoundPage,
  ErrorPage,
  LoadingPage,
  AccessDeniedPage,
  type PageStateProps,
} from './pages.js';

export {
  themeSchema,
  themeCatalog,
  themeKey,
  themeTokens,
  themeFileSchema,
  themeFileSchemaUrl,
  parseThemeFile,
  stringifyThemeFile,
  type ShellThemeDefinition,
  type ShellThemeInput,
  type ThemeEntry,
} from './themes.js';
export { themeService, type ThemeService } from './services/themes.js';

export { shellSlots } from './slots.js';

export {
  ShellSurface,
  ShellFullPage,
  ShellFooter,
  ShellHeaderRow,
  ShellDrawer,
  type ShellSurfaceProps,
  type ShellDrawerProps,
} from './components/regions.js';
