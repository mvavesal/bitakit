# Settings (user preferences)

Use a setting for a value the user chooses and expects to keep after a reload: a limit, an
on/off choice, a display option. In-memory feature state belongs in a service `store()`.

## Declare settings

```bash
npx bitakit add settings todos
```

`src/plugins/todos/settings.ts` (one file per plugin; edit it when it already exists):

```ts
import { defineSettings, setting } from '@bitakit/core';

export default defineSettings(
  {
    limit: setting({ default: 20, control: 'number', label: 'Maximum todos' }),
    newOnTop: setting({ default: false, label: 'New todos on top' }),
  },
  { title: 'Todos', order: 10 },
);
```

- The key is `<plugin>.<name>`: `todos.limit`, `todos.newOnTop`. Names use letters, digits, `_`
  or `-`, no dots. The command refuses to overwrite an existing `settings.ts`.
- `setting()` requires `default`. Optional: `label`, `description`, `control`, `options`,
  `schema`, `scope`, `group`, `order`, `hidden`. The type follows `default`, `options` or `schema`.
- `control` is one of `switch`, `select`, `radio`, `cards`, `text`, `textarea`, `number`. Leave it
  out to infer it: boolean → switch, `options` → select, number → number, string → text.
- `scope` is `user` (default), `device` or `organization`. An `organization` setting stays at its
  default and read-only until the `auth` service reports an active organization; use it only in
  such apps.
- `options` (`[{ value, label?, description? }]`) limits the value to the list; `schema` takes a
  synchronous Standard Schema (zod, valibot) the app already depends on.
- The second argument styles the page: `title`, `description`, `icon`, `path` (URL segment,
  default the plugin ID), `category`, `order`, `shortcut` (for example `'Alt+Shift+T'`).

## Read and write in Actions

The sample's `src/plugins/todos/actions/add.ts` reads `todos.limit`:

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add',
  enabled: ({ input, services, settings }) =>
    !!input?.trim() && services.todos.items.state.get().items.length < settings.todos.limit.get(),
  execute: ({ services, input }) => services.todos.items.add(input),
});
```

- Presentation functions (`title`, `enabled`, `visible`, `href`, `confirm`, ...) and `execute`
  receive `settings`; `success` and `failure` do not.
  Read with `settings.todos.limit.get()`; presentation re-runs when the value changes.
- Write with `settings.todos.newOnTop.set(value)` or `.reset()`. Both return a promise of
  `'saved' | 'superseded' | 'cancelled'`. They reject on an invalid value, a read-only setting, a
  failed save, or before stored values have loaded (`settings.todos.newOnTop.state().ready`).
- Read the setting where you need it; a copy in a service store goes stale.

## Read in a service

Services get the same `settings` in their factory. `src/plugins/todos/services/items.ts`:

```ts
import { defineService } from '@bitakit/core';

export type Todo = { id: number; title: string };

export default defineService(({ store, events, settings }) => {
  const state = store<{ items: Todo[] }>({ items: [] });
  let next = 1;
  return {
    state,
    add(title: string) {
      const item = { id: next++, title: title.trim() };
      const newOnTop = settings.todos.newOnTop.get();
      state.set((current) => ({
        items: newOnTop ? [item, ...current.items] : [...current.items, item],
      }));
      events.emit('todos.changed', { kind: 'added', title: item.title });
    },
    remove(id: number) {
      const item = state.get().items.find((entry) => entry.id === id);
      state.set((current) => ({ items: current.items.filter((entry) => entry.id !== id) }));
      if (item) events.emit('todos.changed', { kind: 'removed', title: item.title });
    },
    clear() {
      state.set({ items: [] });
      events.emit('todos.changed', { kind: 'cleared' });
    },
  };
});
```

- Call `.get()` inside methods, not in the factory body: the factory runs before stored values
  load, so a value read there stays at its default. Each call sees the latest choice.

## Use a setting in React

`src/plugins/todos/ui/new-on-top-toggle.tsx`; import it in `ui/pages/index.tsx` and render
`<NewOnTopToggle />`:

```tsx
'use client';
import { useSetting } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

export function NewOnTopToggle() {
  const newOnTop = useSetting('todos.newOnTop');
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={newOnTop.disabled}
      onClick={() => newOnTop.set(!newOnTop.value)}
    >
      {newOnTop.value ? 'New todos on top' : 'New todos at the bottom'}
    </Button>
  );
}
```

- `useSetting(key)` returns `{ value, ready, writable, pending, error?, disabled, set, reset,
key, definition }`; `disabled` covers not loaded, read-only and saving. Keys are typed by
  `bitakit generate` (part of `npm run typecheck`).
- For the standard labelled field outside `/settings`, render
  `<SettingField settingKey="todos.newOnTop" />` from `@bitakit/app-preferences`.

## Show and customize the Settings page

Each `settings.ts` gets a generated page at `/settings/todos` with a navigation entry (and a Quick
Search result when `@bitakit/quick-search` is installed, the create-app default). It needs `@bitakit/app-preferences` in `package.json` and the route
`src/app/settings/[[...section]]/page.tsx` rendering `<SettingsRoute />` (create-app default).

```bash
npx bitakit add settings-page todos
```

`src/plugins/todos/ui/settings/page.tsx` replaces the generated body and keeps its URL and
navigation:

```tsx
'use client';
import type { ReactNode } from 'react';
import type { SettingsCatalogField, SettingsCatalogSection } from '@bitakit/app-preferences';

export default function SettingsPage({
  section,
  renderField,
}: {
  section: SettingsCatalogSection;
  renderField: (field: SettingsCatalogField) => ReactNode;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Todos live in memory; these preferences are saved.
      </p>
      {section.fields.map(renderField)}
    </>
  );
}
```

- `renderField` keeps the standard control, saving state, inline error and reset. A `hidden`
  setting stays off every page but works in code.

## Persistence

- Values are saved in browser storage by default, per browser (and per signed-in user for `user`
  scope); another device or cleared site data starts from the defaults.
- To save on a server, add one host service with `provides: settingsStorage` (see the
  `@bitakit/app-preferences` README); `settings.ts` files stay unchanged.

## Explain it to the user

Say which plugin owns the setting (`todos` declares `todos.newOnTop` in its `settings.ts`), who
reads it (the `todos.items` service when adding; `useSetting` in the page) and where to change it:
`/settings/todos`. To try it, turn on the switch there and add two todos on `/todos`: the newest is on top.
Reload: the switch is still on in this browser, and the todos are gone (they live in memory).
