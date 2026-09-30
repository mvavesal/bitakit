import Icon from 'reicon-react/icons/Palette';
import { AppearanceSettings } from './appearance-settings';
import { SettingsSection, SettingsGroup } from '@bitakit/app-preferences';
import { themeSetting } from '../../definitions';
export function appearanceSettings(t: (key: string) => string) {
  return new SettingsSection({
    id: 'appearance',
    title: t('Appearance.title'),
    description: t('Appearance.description'),
    icon: Icon,
    component: AppearanceSettings,
    groups: [new SettingsGroup({ title: t('Appearance.title'), items: [themeSetting] })],
    category: {
      id: 'preferences',
      title: t('Nav.preferences'),
      description: t('Settings.preferencesDescription'),
    },
  });
}
