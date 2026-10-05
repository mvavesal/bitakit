import { defineSlot } from '@bitakit/core';
import { z } from 'zod';

/** Existing widget IDs are preserved; logical Action groups do not define destinations. */
export const shellSlots = {
  navigation: defineSlot({ accepts: 'actions' }),
  toolbar: defineSlot({ accepts: 'actions' }),
  brand: defineSlot({ accepts: 'component' }),
  'header.start': defineSlot({ accepts: 'component' }),
  'header.center': defineSlot({ accepts: 'component' }),
  'header.end': defineSlot({ accepts: 'component' }),
  'header.rows': defineSlot({ accepts: 'component' }),
  'header.row.start': defineSlot({
    accepts: 'component',
    payload: z.object({ rowId: z.string() }),
  }),
  'header.row.end': defineSlot({ accepts: 'component', payload: z.object({ rowId: z.string() }) }),
  'content.before': defineSlot({ accepts: 'component' }),
  'content.after': defineSlot({ accepts: 'component' }),
  pageFooter: defineSlot({ id: 'shell.footer', accepts: 'component' }),
  'sidebar.body': defineSlot({
    id: 'sidebar.body',
    accepts: 'component',
    payload: z.object({ collapsed: z.boolean() }),
  }),
  'navigation.group.before': defineSlot({
    accepts: 'component',
    payload: z.object({ groupId: z.string() }),
  }),
  'navigation.group.after': defineSlot({
    accepts: 'component',
    payload: z.object({ groupId: z.string() }),
  }),
  'drawer.header': defineSlot({
    accepts: 'component',
    payload: z.object({ drawerId: z.string() }),
  }),
  'drawer.body': defineSlot({ accepts: 'component', payload: z.object({ drawerId: z.string() }) }),
  'drawer.footer': defineSlot({
    accepts: 'component',
    payload: z.object({ drawerId: z.string() }),
  }),
  'state.content': defineSlot({
    accepts: 'component',
    policy: 'keyed',
    payload: z.object({ surfaceId: z.string() }),
  }),
  'state.actions': defineSlot({
    accepts: 'component',
    payload: z.object({ surfaceId: z.string() }),
  }),

  header: defineSlot({
    id: 'sidebar.header',
    accepts: 'component',
    payload: z.object({ collapsed: z.boolean() }),
  }),
  footer: defineSlot({
    id: 'sidebar.footer',
    accepts: 'component',
    payload: z.object({ collapsed: z.boolean() }),
  }),
  appBar: defineSlot({ id: 'app-bar.end', accepts: 'component' }),
} as const;
export default shellSlots;
declare module '@bitakit/core' {
  interface SlotMap {
    'shell.brand': (typeof shellSlots)['brand'];
    'shell.header.start': (typeof shellSlots)['header.start'];
    'shell.header.center': (typeof shellSlots)['header.center'];
    'shell.header.end': (typeof shellSlots)['header.end'];
    'shell.header.rows': (typeof shellSlots)['header.rows'];
    'shell.header.row.start': (typeof shellSlots)['header.row.start'];
    'shell.header.row.end': (typeof shellSlots)['header.row.end'];
    'shell.content.before': (typeof shellSlots)['content.before'];
    'shell.content.after': (typeof shellSlots)['content.after'];
    'shell.footer': typeof shellSlots.pageFooter;
    'shell.navigation.group.before': (typeof shellSlots)['navigation.group.before'];
    'shell.navigation.group.after': (typeof shellSlots)['navigation.group.after'];
    'shell.drawer.header': (typeof shellSlots)['drawer.header'];
    'shell.drawer.body': (typeof shellSlots)['drawer.body'];
    'shell.drawer.footer': (typeof shellSlots)['drawer.footer'];
    'shell.state.content': (typeof shellSlots)['state.content'];
    'shell.state.actions': (typeof shellSlots)['state.actions'];
    'sidebar.body': (typeof shellSlots)['sidebar.body'];
    'shell.navigation': typeof shellSlots.navigation;
    'shell.toolbar': typeof shellSlots.toolbar;
    'sidebar.header': typeof shellSlots.header;
    'sidebar.footer': typeof shellSlots.footer;
    'app-bar.end': typeof shellSlots.appBar;
  }
}
