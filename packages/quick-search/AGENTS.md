# @bitakit/quick-search — guide for agents

> For agents building an app with this package (it ships in
> `node_modules/@bitakit/quick-search`). To change the package itself, follow the repository's
> own AGENTS.md instead.

Quick Search is the Mod+K search dialog with a trigger in the header (`app-bar.end`). It lists
pages, Settings pages and plugins out of the box, and any plugin can add its own data as a
search source. It is a discovered plugin with the ID `quick-search`; create-app installs it.

## What it provides

| Kind     | IDs                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action   | `quick-search.open` (opens the dialog; bind it to any control)                                                                                     |
| Service  | `quick-search.search`                                                                                                                              |
| Settings | `quick-search.sources`, `quick-search.showSource`, `quick-search.showRecentResults`, `quick-search.historyEnabled` (page `/settings/quick-search`) |
| Slot     | `quick-search.sources` (accepts data: a `SearchSource`)                                                                                            |
| Options  | `src/configs/quick-search.ts`: `title`, `placeholder`, `empty`, `shortcut`, `results: { pages, settings, plugins }`                                |

Navigation Actions with an `href` (and Settings pages) are found without any code. Commands
and dialogs are excluded.

## Make a feature searchable (the usual task)

Attach a source from the feature's own `setup.ts`; Quick Search is not edited.

```ts
// src/plugins/catalog/setup.ts
import type { Setup } from '@bitakit/core';
import type { SearchSource } from '@bitakit/quick-search/sources';

const source: SearchSource = {
  title: { key: 'catalog.search.title', fallback: 'Lessons' },
  description: 'Lessons of the catalog.',
  category: { id: 'learning', title: 'Learning' },
  defaultEnabled: true,
  async search({ query, signal, score }) {
    const lessons = await fetch('/api/lessons', { signal }).then((response) => response.json());
    return lessons
      .filter((lesson) => !query || score(lesson.title) > 0)
      .map((lesson) => ({ id: lesson.id, title: lesson.title, href: `/catalog/${lesson.id}` }));
  },
  async resolve(id, { signal }) {
    // Re-read current data and access; never trust history.
    const lesson = await fetch(`/api/lessons/${id}`, { signal }).then((response) =>
      response.ok ? response.json() : null,
    );
    return lesson && { id, title: lesson.title, href: `/catalog/${id}` };
  },
};

const setup: Setup = ({ scope }) => {
  // Optional integration: the feature still runs without Quick Search.
  if (!scope.slots.has('quick-search.sources')) return;
  const handle = scope.slots.attach(
    { slot: 'quick-search.sources', id: 'lessons', data: source },
    { availability: 'wait' },
  );
  return () => handle.dispose();
};
export default setup;
```

- A result is a link `{ id, title, href, description?, image? }` or an Action reference
  `{ id, actionId }`. Unsafe `href`s are dropped.
- Pass `signal` to every request: a new query aborts the previous one.
- Return the cleanup; give the source a stable `id` (Core qualifies it, `catalog:lessons`).
- `examples/catalog/setup.ts` in this package is a complete local example.

## Rules

- Authorize on the server: a visible or remembered result never grants access.
- `resolve` re-reads the item; history stores only IDs and queries.
- Keep the trigger in `app-bar.end`; a custom header renders `QuickSearchTrigger` or that slot.
- Style changes go through the central theme; the README lists the public classes for
  deliberate app CSS.

## More

README sections: Add a source, Preferences and history, External component CSS.

The built `foundation.slots.json` also records the static runtime ID `quick-search`. Discovery
uses that generated evidence for binding checks; npm scope does not imply bundle membership.

Page/settings result details use the host plugin-name translation, then canonical metadata.title, legacy metadata.name and the plugin ID. This only changes labels, not destination ownership or navigation.
