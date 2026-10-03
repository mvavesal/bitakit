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
  NotFoundPage,
  ErrorPage,
  LoadingPage,
  AccessDeniedPage,
  type PageStateProps,
} from './pages.js';
