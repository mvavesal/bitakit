import { pluginsSettings } from './sections/plugins/contribution';
import { organizationSettings } from './sections/organization/contribution';
import { appearanceSettings } from './sections/appearance/contribution';
import { languageSettings } from './sections/language/contribution';
import { SettingsSection } from '@bitakit/app-preferences/core';
import { settingsCategories } from './categories';

/** The explicit catalog of built-in sections. Trusted plugins use the same SettingsSection contract. */
export function standardSettings(t: (key: string) => string) {
  const categories = settingsCategories(t);
  return [
    appearanceSettings(t),
    languageSettings(t),
    ...organizationSettings(t),
    pluginsSettings(t),
  ].map(
    (section) =>
      new SettingsSection({
        ...section,
        category: section.id.startsWith('organization')
          ? categories.organization
          : section.id === 'plugins'
            ? categories.administration
            : categories.account,
      }),
  );
}
