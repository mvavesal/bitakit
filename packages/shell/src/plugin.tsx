'use client';
import { definePlugin, defineService, type ServiceContext, type SettingHandle } from '@bitakit/core';
import { createThemeService, themeService } from './services/themes.js';
import { type ThemeLibrary } from './themes.js';
import { bundledThemes } from './bundled-themes.js';
import { selectTheme, saveThemeCopy, updateTheme, deleteTheme } from './actions/themes.js';
import { testNotification } from './actions/test-notification.js';
import LayoutIcon from 'reicon-react/icons/Layout';
import { shellSlots } from './slots.js';
import { appearanceSettings } from './appearance.js';
import { parseShellOptions, type ShellOptions } from './options.js';
import { notificationService, translatedNotifications } from './services/notifications.js';
import { createNotificationService } from './ui/notification-queue.js';
import { ShellNotifications } from './ui/providers/notifications.js';
import { AppearanceSettings } from './ui/settings/appearance.js';
import { ShellTheme } from './ui/providers/theme.js';

/** `app.services.notifications` on HeroUI's toast queue, translated through `i18n`. */
const notifications = defineService(
  ({ services, onStop }: ServiceContext) => {
    const queue = createNotificationService();
    onStop(queue.dispose);
    return translatedNotifications(queue, services, queue.assertActive);
  },
  { provides: notificationService },
);

/**
 * The Shell plugin: appearance settings, the notification service and the providers that
 * project the theme and render the toast region. `AppShell` renders the frame.
 */
export function shellPlugin(options: ShellOptions = {}) {
  const { navigationSlot = 'shell.navigation', presets = [], themes = [] } = parseShellOptions(options);
  return definePlugin({
    id: 'shell',
    metadata: {
      tags: ["system", "design"],
      icon: LayoutIcon,
      name: 'App Shell',
      description: 'Application frame, navigation layouts, appearance and notifications.',
    },
    config: { navigationSlot },
    slots: shellSlots,
    settings: appearanceSettings(presets),
    services: {
      notifications,
      themes: defineService(({ settings }) => createThemeService(
        (settings as unknown as { shell: { themeLibrary: SettingHandle<ThemeLibrary> } }).shell.themeLibrary,
        bundledThemes,
        themes,
      ), { provides: themeService }),
    },
    actions: { testNotification, selectTheme, saveThemeCopy, updateTheme, deleteTheme },
    ui: {
      settings: { component: AppearanceSettings },
      providers: [
        { id: 'shell.theme', component: ShellTheme },
        { id: 'shell.notifications', component: ShellNotifications },
      ],
      slots: [],
    },
  });
}
