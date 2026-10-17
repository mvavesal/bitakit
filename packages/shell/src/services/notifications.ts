import {
  defineContract,
  getService,
  resolveText,
  translationService,
  type Services,
  type Translator,
} from '@bitakit/core';

export type NotificationId = string | number;
export type NotificationOptions = Readonly<{
  type?: 'success' | 'error' | 'info' | 'warning';
  description?: string;
  /** Interpolation values shared by the message and description translation keys. */
  values?: Parameters<Translator>[1];
  /** Milliseconds before dismissal; zero keeps the notification open. */
  duration?: number;
}>;
/** The public notification contract: `app.services.notifications`. */
export interface NotificationService {
  show(message: string, options?: NotificationOptions): NotificationId;
  dismiss(id: NotificationId): void;
}
/** The literal name types `app.services.notifications` wherever the plugin is installed. */
export const notificationService = defineContract('notifications').of<NotificationService>();

/**
 * Translates the message and description once at the service boundary, through the `i18n`
 * contract when one is installed. Keys resolve to their text; plain text passes through.
 */
export function translatedNotifications(
  service: NotificationService,
  services: Services,
  assertActive: () => void = () => {},
): NotificationService {
  const text = (value: string, values: NotificationOptions['values']) => {
    const translate = 'i18n' in services ? getService(services, translationService).translate : undefined;
    return translate ? resolveText(translate, value, value, values) : value;
  };
  return {
    show: (message, options = {}) => {
      assertActive();
      return service.show(text(message, options.values), {
        ...options,
        description:
          options.description === undefined ? undefined : text(options.description, options.values),
      });
    },
    dismiss: (id) => service.dismiss(id),
  };
}
