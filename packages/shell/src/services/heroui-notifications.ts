import { toast } from '@heroui/react';
import type { NotificationService } from './notifications.js';

/** Uses the same public HeroUI queue as native Better Auth components, without a second store. */
export function createNotificationService(): NotificationService & { dispose(): void } {
  let active = true;
  return {
    show(message, options = {}) {
      if (!active) throw new Error('The notification service is no longer active.');
      const notify = options.type === 'error' ? toast.danger : toast[options.type ?? 'info'];
      return notify(message, { description: options.description, timeout: options.duration });
    },
    dismiss(id) {
      if (!active) throw new Error('The notification service is no longer active.');
      toast.close(String(id));
    },
    dispose() {
      active = false;
    },
  };
}
