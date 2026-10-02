import {
  serviceKey,
  resolveText,
  type Translator,
  type ServiceDefinition,
  type LegacyServiceDefinition,
} from '@bitakit/core';

export type NotificationId = string | number;

export type NotificationOptions = Readonly<{
  type?: 'success' | 'error' | 'info' | 'warning';
  description?: string;
  /** Interpolation values shared by the title and description translation keys. */
  values?: Parameters<Translator>[1];
  /** Milliseconds before dismissal; zero keeps the notification open. */
  duration?: number;
}>;
/** Public developer contract; presentation remains owned by the optional Shell integration. */
export interface NotificationService {
  show(message: string, options?: NotificationOptions): NotificationId;
  dismiss(id: NotificationId): void;
}
export const notificationService = serviceKey<NotificationService>('notifications');

/** Translate once at the service boundary, including replacement renderers. */
export function translatedNotifications(
  definition: Omit<LegacyServiceDefinition<NotificationService>, 'id'>,
): Omit<LegacyServiceDefinition<NotificationService>, 'id'> {
  const originals = new WeakMap<NotificationService, NotificationService>();
  return {
    ...definition,
    create(context) {
      const original = definition.create(context);
      const service: NotificationService = {
        show(message, options = {}) {
          const translate = context.services.i18n?.translate;
          const text = (value: string) =>
            translate ? resolveText(translate, value, value, options.values) : value;
          return original.show(text(message), {
            ...options,
            description: options.description === undefined ? undefined : text(options.description),
          });
        },
        dismiss(id) {
          original.dismiss(id);
        },
      };
      originals.set(service, original);
      return service;
    },
    dispose(service) {
      const original = originals.get(service);
      if (original) definition.dispose?.(original);
      originals.delete(service);
    },
  };
}
