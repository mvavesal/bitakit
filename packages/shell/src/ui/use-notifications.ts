'use client';
import { useService } from '@bitakit/ui';
import type { NotificationService } from '../services/notifications.js';

/** `app.services.notifications`, or undefined until the runtime is ready. */
export function useNotifications(): NotificationService | undefined {
  return useService('notifications') as NotificationService | undefined;
}
