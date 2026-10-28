import { createLocalSettingsStorage, defineService, settingsStorage } from '@bitakit/core';

/** Throws the server's message, so the settings page shows it beside the field. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

/**
 * Where this app keeps settings. One service with `provides: settingsStorage` replaces the
 * default browser storage for every setting; `settings.ts` files stay unchanged. It sends the
 * profile plugin's user settings to the server (SQLite, through src/app/api/settings) and keeps
 * everything else, such as Shell's appearance and device-scoped settings, in this browser.
 */
export default defineService(
  () => {
    const browser = createLocalSettingsStorage();
    const onServer = (key: string, scope: string) => key.startsWith('profile.') && scope === 'user';
    // One request answers every server-side key while the app starts.
    let all: Promise<Record<string, unknown>> | undefined;
    const serverValues = () =>
      (all ??= send('/api/settings')
        .then((response) => response.json() as Promise<{ values: Record<string, unknown> }>)
        .then(({ values }) => values)
        .finally(() => {
          all = undefined;
        }));

    return {
      async load(key, context) {
        if (!onServer(key, context.scope)) return browser.load(key, context);
        return { value: (await serverValues())[key], writable: true };
      },
      async save(key, value, context) {
        if (!onServer(key, context.scope)) return browser.save(key, value, context);
        await send('/api/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, value }),
        });
      },
      async reset(key, context) {
        if (!onServer(key, context.scope)) return browser.reset!(key, context);
        await send(`/api/settings?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
        return { value: undefined, writable: true };
      },
    };
  },
  { provides: settingsStorage },
);
