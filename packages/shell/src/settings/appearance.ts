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
      title: 'Color scheme',
      description: 'Light, dark or matching your system.',
      defaultValue: 'system',
      options: [
        { value: 'light', label: 'Light', description: 'Always use a light appearance.' },
        { value: 'dark', label: 'Dark', description: 'Always use a dark appearance.' },
        { value: 'system', label: 'System', description: 'Follow your operating system.' },
      ],
      presentation: { variant: 'cards', columns: 3 },
    }),
    layout: choiceField({
      title: 'Navigation',
      description: 'Choose the navigation layout. Content stays open.',
      defaultValue: 'sidebar',
      options: [
        { value: 'sidebar', label: 'Sidebar', description: 'Navigation on the left, content on the right.' },
        {
          value: 'navbar',
          label: 'Horizontal navigation',
          description: 'Navigation above the content.',
        },
      ],
      presentation: { variant: 'cards', columns: 2 },
    }),
  },
});
export const shellTheme = shellPreferences.fields.theme;
export const shellLayout = shellPreferences.fields.layout;
