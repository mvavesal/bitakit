'use client';
import { definePlugin, defineService, type ServiceContext } from '@bitakit/core';
import LayoutIcon from 'reicon-react/icons/Layout';
import { appearanceSettings } from './appearance.js';
import { parseShellOptions, type ShellOptions } from './options.js';
import { notificationService, translatedNotifications } from './services/notifications.js';
import { createNotificationService } from './ui/notification-queue.js';
import { ShellNotifications } from './ui/providers/notifications.js';
import { ShellTheme } from './ui/providers/theme.js';

/** `app.services.notifications` on HeroUI's toast queue, translated through `i18n`. */
const notifications = defineService(
  ({ services, onStop }: ServiceContext) => {
    const queue = createNotificationService();
    onStop(queue.dispose);
    return translatedNotifications(queue, services);
  },
  { provides: notificationService },
);

/**
 * The Shell plugin: appearance settings, the notification service and the providers that
 * project the theme and render the toast region. `AppShell` renders the frame.
 */
export function shellPlugin(options: ShellOptions = {}) {
  const { groups = ['navigation'], presets = [] } = parseShellOptions(options);
  return definePlugin({
    id: 'shell',
    metadata: {
      icon: LayoutIcon,
      name: 'App Shell',
      description: 'Application frame, navigation layouts, appearance and notifications.',
    },
    config: { groups },
    settings: appearanceSettings(presets),
    services: { notifications },
    ui: {
      providers: [
        { id: 'shell.theme', component: ShellTheme },
        { id: 'shell.notifications', component: ShellNotifications },
      ],
      slots: [],
    },
  });
}
