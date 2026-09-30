import type { ActionEnvironment } from '@bitakit/core';
import { bindSettings } from '@bitakit/app-preferences/actions';
import { localeSetting } from '@/settings/definitions';
export const LOCALE_ACTION_ID = 'locale.set';

export default function localeAction({ services }: ActionEnvironment) {
  return bindSettings(services.settings)({
    id: LOCALE_ACTION_ID,
    title: 'Change language',
    setting: localeSetting,
  });
}
