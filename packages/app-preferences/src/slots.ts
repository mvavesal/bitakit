import { defineSlot } from '@bitakit/core';
import { z } from 'zod';

/** Page IDs come from the existing catalog, independently of paths and translated titles. */
const pageContext = z.object({ pageId: z.string() });
export const settingsSlots = {
  navigation: defineSlot({ accepts: 'actions' }),
  'navigation.header': defineSlot({ accepts: 'component' }),
  'navigation.group.before': defineSlot({
    accepts: 'component',
    payload: z.object({ groupId: z.string() }),
  }),
  'navigation.group.after': defineSlot({
    accepts: 'component',
    payload: z.object({ groupId: z.string() }),
  }),
  'page.header': defineSlot({ accepts: 'component', payload: pageContext }),
  'page.before': defineSlot({ accepts: 'component', payload: pageContext }),
  'page.footer': defineSlot({ accepts: 'component', payload: pageContext }),

  'navigation.footer': defineSlot({ accepts: 'component' }),
  'page.body': defineSlot({ accepts: 'component', policy: 'keyed', payload: pageContext }),
  'page.after': defineSlot({ accepts: 'component', payload: pageContext }),
  'page.toolbar': defineSlot({ accepts: 'actions', payload: pageContext }),
} as const;
export default settingsSlots;

declare module '@bitakit/core' {
  interface SlotMap {
    'app-preferences.navigation.header': (typeof settingsSlots)['navigation.header'];
    'app-preferences.navigation.group.before': (typeof settingsSlots)['navigation.group.before'];
    'app-preferences.navigation.group.after': (typeof settingsSlots)['navigation.group.after'];
    'app-preferences.page.header': (typeof settingsSlots)['page.header'];
    'app-preferences.page.before': (typeof settingsSlots)['page.before'];
    'app-preferences.page.footer': (typeof settingsSlots)['page.footer'];

    'app-preferences.navigation': typeof settingsSlots.navigation;
    'app-preferences.navigation.footer': (typeof settingsSlots)['navigation.footer'];
    'app-preferences.page.body': (typeof settingsSlots)['page.body'];
    'app-preferences.page.after': (typeof settingsSlots)['page.after'];
    'app-preferences.page.toolbar': (typeof settingsSlots)['page.toolbar'];
  }
}
