import { getService, type Setup } from '@bitakit/core';
import { SettingsSection } from '@bitakit/app-preferences';
import { settingsService } from '@bitakit/app-preferences/foundation';
import Icon from 'reicon-react/icons/Flask';
import { DemoSettings } from './ui/components/demo-settings';

/** Registers the plugin's settings page under the host's "Plugins" section; the scope removes it with the plugin. */
const setup: Setup = ({ scope, services }) => {
  const page = getService(services, settingsService).add(
    new SettingsSection({
      id: 'demo',
      pluginId: 'demo',
      title: 'Demo',
      component: DemoSettings,
      icon: Icon,
    }),
    { section: 'plugins' },
  );
  scope.own(page.remove);
};
export default setup;
