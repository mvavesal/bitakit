/** This application's navigation taxonomy; unrelated to persistence scopes. */
export function settingsCategories(t: (key: string) => string) {
  return {
    account: { id: 'personal', title: t('Settings.myAccount'), order: 0 },
    organization: { id: 'organization', title: t('Settings.organization'), order: 10 },
    administration: { id: 'administration', title: t('Settings.administration'), order: 20 },
  };
}
