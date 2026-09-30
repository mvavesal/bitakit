/** Texts used by the default views. Hosts pass translated messages; `{key}` is interpolated. */
export type SettingsMessages = Readonly<{
  saving: string;
  loading: string;
  loadFailed: string;
  saveFailed: string;
  invalid: string;
  readOnly: string;
  reset: string;
  unregistered: string;
  configuration: string;
  empty: string;
  navigation: string;
  unavailable: string;
}>;
export const defaultSettingsMessages: SettingsMessages = Object.freeze({
  saving: 'Saving…',
  loading: 'Loading…',
  loadFailed: 'This setting could not be loaded.',
  saveFailed: 'The change could not be saved. Please try again.',
  invalid: 'Enter a valid value.',
  readOnly: 'You cannot change this setting.',
  reset: 'Reset to default',
  unregistered: 'Setting "{key}" is referenced but not registered.',
  configuration: 'Settings configuration error',
  empty: 'This section has no settings.',
  navigation: 'Settings sections',
  unavailable: 'This settings section is not available.',
});
export function formatMessage(template: string, values: Readonly<Record<string, string>> = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
