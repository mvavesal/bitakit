import { choiceField, defineSettings } from '@bitakit/app-preferences/core';

/**
 * Shell preferences. Keys stay `shell.theme` and `shell.layout`; icons and card layouts live in
 * the Shell renderers, so these definitions remain React-free.
 */
export const shellPreferences = defineSettings({
  id: 'shell',
  scope: 'user',
  fields: {
    theme: choiceField({
      title: 'Farbschema',
      description: 'Hell, dunkel oder passend zu deinem System.',
      defaultValue: 'system',
      options: [
        { value: 'light', label: 'Hell', description: 'Immer helle Oberfläche.' },
        { value: 'dark', label: 'Dunkel', description: 'Immer dunkle Oberfläche.' },
        { value: 'system', label: 'System', description: 'Folgt deinem Betriebssystem.' },
      ],
      presentation: { variant: 'cards', columns: 3 },
    }),
    layout: choiceField({
      title: 'Navigation',
      description: 'Wähle die Anordnung deiner Navigation. Inhalte bleiben geöffnet.',
      defaultValue: 'sidebar',
      options: [
        { value: 'sidebar', label: 'Sidebar', description: 'Navigation links, Inhalte rechts.' },
        {
          value: 'navbar',
          label: 'Horizontale Navbar',
          description: 'Navigation über dem Inhaltsbereich.',
        },
      ],
      presentation: { variant: 'cards', columns: 2 },
    }),
  },
});
export const shellTheme = shellPreferences.fields.theme;
export const shellLayout = shellPreferences.fields.layout;
