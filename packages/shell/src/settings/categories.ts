/** Default plugin settings taxonomy. IDs are presentation only and never grant storage or domain access. */
export const settingsCategories = {
  general: { id: 'general', title: 'Allgemein', order: -10 },
  appearance: { id: 'appearance', title: 'Darstellung', order: -5 },
  account: { id: 'personal', title: 'Mein Konto', order: 0 },
  organization: { id: 'organization', title: 'Organisation', order: 10 },
  administration: { id: 'administration', title: 'Anwendungsverwaltung', order: 20 },
};
