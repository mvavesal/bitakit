import { fallbackTitle, resolveText, type Translator } from '@bitakit/core';

export type MessageValues = Readonly<Record<string, string | number>>;
type Message = string | ((values: MessageValues) => string);

/**
 * The English texts this package renders. Catalogs translate them under
 * `app-preferences.ui.<key>`; `locales/en.json` repeats them for hosts with a translator.
 */
export const defaultMessages = {
  settings: 'Settings',
  back: 'Back to app',
  navigation: 'Settings navigation',
  toggleNavigation: 'Toggle settings navigation',
  breadcrumb: 'Breadcrumb',
  skip: 'Skip to settings',
  search: 'Search settings',
  searchPlaceholder: 'Search settings…',
  clearSearch: 'Clear search',
  noResults: 'No settings found',
  noResultsHint: 'Try another search term.',
  resetSearch: 'Reset search',
  results: ({ count }) => (count === 1 ? '1 section found' : `${count} sections found`),
  unavailable: 'This settings page is not available.',
  noFields: 'This section has no settings.',
  saving: 'Saving…',
  readOnly: 'You cannot change this setting.',
  reset: 'Reset {label} to default',
  loadFailed: 'This setting could not be loaded: {error}',
  saveFailed: 'The change could not be saved: {error}',
  unsupported: 'This setting cannot be changed here.',
  plugins: 'Plugins',
  pluginName: 'Plugin',
  tags: 'Tags',
  filterTags: 'Filter by tag',
  filterStatus: 'Filter by status',
  allPlugins: 'All plugins',
  enabledPlugins: 'Enabled',
  disabledPlugins: 'Disabled',
  clearTags: 'Clear tags',
  searchPlugins: 'Search plugins',
  searchPluginsPlaceholder: 'Search plugins…',
  clearPluginSearch: 'Clear plugin search',
  noPlugins: 'No plugins found.',
  noPluginsHint: 'Try another search or change the filters.',
  author: 'By {author}',
  backToPlugins: 'Back to plugins',
  pluginUnavailable: 'Plugin unavailable',
  pluginUnavailableHint: 'This plugin is not installed.',
  aboutPlugin: 'About this plugin',
  noDescription: 'No description is available for this plugin.',
  pluginSettings: 'Settings',
  noPluginSettings: 'This plugin has no settings.',
  openSettings: 'Open settings',
  information: 'Information',
  version: 'Version',
  unspecified: 'Not specified',
  license: 'License',
  website: 'Website',
  projectWebsite: 'Project website',
  support: 'Support',
  supportLink: 'Get help and report issues',
} satisfies Record<string, Message>;
export type MessageKey = keyof typeof defaultMessages;

/** Replaces `{name}` placeholders; unknown placeholders stay as they are. */
export function fill(text: string, values?: MessageValues): string {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
export function messageKey(key: MessageKey): string {
  return `app-preferences.ui.${key}`;
}
/** The English text with its values filled in, used when no translation exists. */
export function defaultMessage(key: MessageKey, values?: MessageValues): string {
  const message: Message = defaultMessages[key];
  return typeof message === 'function' ? message(values ?? {}) : fill(message, values);
}
/** A package text through a translator, for code without React such as plugin setup. */
export function message(
  translate: Translator | undefined,
  key: MessageKey,
  values?: MessageValues,
): string {
  const fallback = defaultMessage(key, values);
  return translate ? resolveText(translate, messageKey(key), fallback, values) : fallback;
}

export function categoryTitleKey(id: string): string {
  return `settings.categories.${id}.title`;
}
/** A category title through a translator; the ID in title case without a translation. */
export function categoryTitle(id: string, translate?: Translator): string {
  const fallback = fallbackTitle({ id });
  return translate ? resolveText(translate, categoryTitleKey(id), fallback) : fallback;
}
