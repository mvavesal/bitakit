import { useFoundationApp } from '@bitakit/ui';
import { shellPlugin, type NotificationService } from '../src/index.js';

function consumer() {
  const app = useFoundationApp<readonly [ReturnType<typeof shellPlugin>]>();
  const id = app.services.notifications.show('Saved', { type: 'success', duration: 2000 });
  app.services.notifications.dismiss(id);
  // @ts-expect-error Unsupported notification variants do not cross the public contract.
  app.services.notifications.show('Saved', { type: 'danger' });
  // @ts-expect-error Duration is expressed in milliseconds, not a CSS/time string.
  app.services.notifications.show('Saved', { duration: '2s' });
}
void consumer;
const custom: NotificationService = {
  show() {
    return 42;
  },
  dismiss(id) {
    void id;
  },
};
shellPlugin({ notifications: { toastProvider: false, service: { create: () => custom } } });
