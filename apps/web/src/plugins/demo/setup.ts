import { defineSetup } from '@bitakit/core';
import { SettingsSection } from '@bitakit/app-preferences';
import Icon from 'reicon-react/icons/Flask';
import { DemoSettings } from './components/demo-settings';

export default defineSetup(({ services }) => {
  const page = services.settings.add(
    new SettingsSection({
      id: 'demo',
      pluginId: 'demo',
      title: 'Demo',
      component: DemoSettings,
      icon: Icon,
    }),
    { section: 'plugins' },
  );
  return page.remove;
});
