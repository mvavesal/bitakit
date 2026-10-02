import { choiceField, defineSettings, textField } from '@bitakit/app-preferences/core';
import { z } from 'zod';

/** Personal visual preferences; defaults preserve the host's existing theme. */
export const themePreferences = defineSettings({
  id: 'shell.style',
  scope: 'user',
  fields: {
    primary: textField({
      title: 'Primary color',
      description: 'Choose a preset or custom color for buttons and selections.',
      defaultValue: 'default',
      schema: z.union([
        z.literal('default'),
        z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color.'),
      ]),
    }),
    sidebarTheme: choiceField({
      title: 'Sidebar color scheme',
      description: 'Choose a color scheme independently of the content.',
      defaultValue: 'default',
      options: [
        { value: 'default', label: 'Like the app' },
        { value: 'light', label: 'Always light' },
        { value: 'dark', label: 'Always dark' },
      ],
      presentation: { variant: 'cards', columns: 3 },
    }),
    corners: choiceField({
      title: 'Corner shape',
      defaultValue: 'default',
      options: [
        { value: 'default', label: 'Default', description: 'The familiar soft contours.' },
        { value: 'round', label: 'Round', description: 'Classically rounded corners.' },
        { value: 'square', label: 'Square', description: 'Straight edges without rounding.' },
      ],
      presentation: { variant: 'cards', columns: 3 },
    }),
    surface: choiceField({
      title: 'Surfaces',
      defaultValue: 'default',
      options: [
        {
          value: 'default',
          label: 'With depth',
          description: 'Subtle gradients, shadows and light.',
        },
        { value: 'flat', label: 'Flat', description: 'Calm surfaces without decorative effects.' },
      ],
      presentation: { variant: 'cards', columns: 2 },
    }),
  },
});
