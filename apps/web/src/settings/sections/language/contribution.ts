import Icon from 'reicon-react/icons/Settings';
import { LanguageSettings } from './language-settings';
import { SettingsSection, SettingsGroup } from '@bitakit/app-preferences';
import { localeSetting } from '../../definitions';
export function languageSettings(t: (key: string) => string) {
  return new SettingsSection({
    id: 'language',
    title: t('Language.title'),
    description: t('Language.description'),
    icon: Icon,
    component: LanguageSettings,
    groups: [new SettingsGroup({ title: t('Language.title'), items: [localeSetting] })],
    category: {
      id: 'preferences',
      title: t('Nav.preferences'),
      description: t('Settings.preferencesDescription'),
    },
  });
}
