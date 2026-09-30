import { choiceField, defineSettings } from '@bitakit/app-preferences/core';

/** Native HeroUI positions; the same preference controls every toast in the shared queue. */
export const notificationPreferences = defineSettings({
  id: 'shell.notifications',
  scope: 'user',
  fields: {
    placement: choiceField({
      title: 'Position der Benachrichtigungen',
      defaultValue: 'bottom',
      presentation: { variant: 'cards', columns: 3 },
      options: [
        { value: 'top start', label: 'Oben am Anfang' },
        { value: 'top', label: 'Oben mittig' },
        { value: 'top end', label: 'Oben am Ende' },
        { value: 'bottom start', label: 'Unten am Anfang' },
        { value: 'bottom', label: 'Unten mittig' },
        { value: 'bottom end', label: 'Unten am Ende' },
      ],
    }),
  },
});
export type NotificationPlacement = typeof notificationPreferences.fields.placement.defaultValue;
