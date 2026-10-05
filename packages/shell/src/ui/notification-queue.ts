import { toast } from '@heroui/react';
import type { NotificationService } from '../services/notifications.js';

/**
 * Notifications on HeroUI's public toast queue, the same queue native HeroUI and Better Auth UI
 * components use, so there is no second store. `dispose` deactivates the instance.
 */
export function createNotificationService(): NotificationService & {
  dispose(): void;
  assertActive(): void;
} {
  let active = true;
  const check = () => {
    if (!active) throw new Error('The notification service is no longer active.');
  };
  return {
    assertActive: check,
    show(message, options = {}) {
      check();
      const notify = options.type === 'error' ? toast.danger : toast[options.type ?? 'info'];
      return notify(message, { description: options.description, timeout: options.duration });
    },
    dismiss(id) {
      check();
      toast.close(String(id));
    },
    dispose() {
      active = false;
    },
  };
}
