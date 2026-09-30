export type Messages = { [key: string]: string | Messages };
/** Per-key overlay: no mutation, no cross-plugin namespace search. */
function merge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new Error('Invalid translation key.');
    result[key] =
      typeof value === 'string'
        ? value
        : merge(typeof result[key] === 'object' ? result[key] : {}, value);
  }
  return result;
}
export function mergePluginMessages({
  app,
  plugins,
  locale,
  fallbackLocale = 'en',
}: {
  app: Record<string, Messages>;
  plugins: Record<string, Messages>;
  locale: string;
  fallbackLocale?: string;
}): Messages {
  return [
    plugins[fallbackLocale],
    app[fallbackLocale],
    plugins[locale],
    app[locale],
  ].reduce<Messages>((messages, layer) => merge(messages, layer ?? {}), {});
}
