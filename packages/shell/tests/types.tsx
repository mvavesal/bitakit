// Type checks for the public API; compiled by `tsc -p tsconfig.test.json`, never executed.
import { defineConfig, useFoundationApp } from '@bitakit/ui';
import {
  AppShell,
  shellOptions,
  shellPlugin,
  useNotifications,
  useShellLayout,
  type NavigationItemProps,
  type NotificationService,
  type ShellOptions,
} from '../src/index.js';

function consumer() {
  const app = useFoundationApp<readonly [ReturnType<typeof shellPlugin>]>();
  const id = app.services.notifications.show('Saved', { type: 'success', duration: 2000 });
  app.services.notifications.dismiss(id);
  const same: NotificationService = app.services.shell.notifications;
  // @ts-expect-error Unsupported notification variants do not cross the public contract.
  app.services.notifications.show('Saved', { type: 'danger' });
  // @ts-expect-error Duration is expressed in milliseconds, not a CSS/time string.
  app.services.notifications.show('Saved', { duration: '2s' });
  const notifications: NotificationService | undefined = useNotifications();
  notifications?.show('Saved', { values: { name: 'Ada' } });
  const layout: 'sidebar' | 'navbar' = useShellLayout();
  void same;
  void layout;
}
void consumer;

// configs/shell.ts: typed defaults, or the exported schema.
defineConfig({
  defaults: {
    groups: ['navigation', 'admin'],
    presets: [{ id: 'ocean', label: 'Ocean' }],
  } satisfies ShellOptions,
});
defineConfig({ schema: shellOptions, defaults: { groups: ['navigation'] } });
shellPlugin({ presets: [{ id: 'ocean' }] });
// @ts-expect-error Removed feature switches are not options.
shellPlugin({ appearance: true });
// @ts-expect-error Preset IDs are strings.
shellPlugin({ presets: [{ id: 1 }] });

function Item({ item, active, layout }: NavigationItemProps) {
  return (
    <a href={item.href} data-active={active || undefined} data-layout={layout}>
      {item.title}
    </a>
  );
}
export const composed = (
  <AppShell components={{ NavigationItem: Item }} groups={['navigation']}>
    <AppShell.Sidebar header="Brand" footer="Account" />
    <AppShell.Content topBar={<AppShell.TopBar header="Title" end="End" />}>Page</AppShell.Content>
  </AppShell>
);
// @ts-expect-error The layouts map keyed by preference value is gone; use components.
export const legacy = <AppShell layouts={{}} />;
