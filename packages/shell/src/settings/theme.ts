import { choiceField, defineSettings, textField } from '@bitakit/app-preferences/core';
import { z } from 'zod';

/** Personal visual preferences; defaults preserve the host's existing theme. */
export const themePreferences = defineSettings({
  id: 'shell.style',
  scope: 'user',
  fields: {
    primary: textField({
      title: 'Primärfarbe',
      description: 'Wähle eine Vorgabe oder eine eigene Farbe für Buttons und Auswahlfelder.',
      defaultValue: 'default',
      schema: z.union([
        z.literal('default'),
        z.string().regex(/^#[0-9a-f]{6}$/i, 'Bitte eine Hex-Farbe mit sechs Stellen verwenden.'),
      ]),
    }),
    sidebarTheme: choiceField({
      title: 'Farbschema der Seitenleiste',
      description: 'Wähle das Farbschema unabhängig vom restlichen Inhalt.',
      defaultValue: 'default',
      options: [
        { value: 'default', label: 'Wie die App' },
        { value: 'light', label: 'Immer hell' },
        { value: 'dark', label: 'Immer dunkel' },
      ],
      presentation: { variant: 'cards', columns: 3 },
    }),
    corners: choiceField({
      title: 'Eckenform',
      defaultValue: 'default',
      options: [
        { value: 'default', label: 'Standard', description: 'Die gewohnten weichen Konturen.' },
        { value: 'round', label: 'Rund', description: 'Klassisch abgerundete Ecken.' },
        { value: 'square', label: 'Eckig', description: 'Gerade Kanten ohne Rundung.' },
      ],
      presentation: { variant: 'cards', columns: 3 },
    }),
    surface: choiceField({
      title: 'Oberflächen',
      defaultValue: 'default',
      options: [
        {
          value: 'default',
          label: 'Mit Tiefe',
          description: 'Dezente Verläufe, Schatten und Licht.',
        },
        { value: 'flat', label: 'Flach', description: 'Ruhige Flächen ohne dekorative Effekte.' },
      ],
      presentation: { variant: 'cards', columns: 2 },
    }),
  },
});
