import type { ActionEnvironment } from '@bitakit/core';
import { bindSettings } from '@bitakit/app-preferences/actions';
import type { ActionList } from '@bitakit/ui/actions';
import type { ThemePreference } from '@/lib/theme/config';
import { themeSetting } from '@/settings/definitions';
export const THEME_ACTION_ID = 'theme.set';
export function executeTheme(list: ActionList, value: ThemePreference) {
  return list.execute(THEME_ACTION_ID, value);
}

export default function themeAction({ services }: ActionEnvironment) {
  return bindSettings(services.settings)({
    id: THEME_ACTION_ID,
    title: 'Change theme',
    setting: themeSetting,
  });
}
