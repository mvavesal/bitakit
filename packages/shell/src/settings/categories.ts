/** Default plugin settings taxonomy. IDs are presentation only and never grant storage or domain access. */
export const settingsCategories = {
  general: { id: 'general', title: 'General', order: -10 },
  appearance: { id: 'appearance', title: 'Appearance', order: -5 },
  account: { id: 'personal', title: 'My account', order: 0 },
  organization: { id: 'organization', title: 'Organization', order: 10 },
  administration: { id: 'administration', title: 'Administration', order: 20 },
};
