# Plugins and pages

Use this when the user asks for a new feature, a new screen or a sidebar entry. The example is
`about`: a page-only plugin at `/about` with a link in the Shell sidebar.

## Create a plugin

```sh
npx bitakit add plugin about
```

- Default: `ui/pages/index.tsx` (served at `/about`) and, only when `@bitakit/shell` is in
  `package.json`, `actions/open.ts`, which places the link in `shell.navigation`. Without Shell
  the page is reached by URL only.
- `--example` writes a complete feature: `services/list.ts`, `events.ts`, the Actions `add`,
  `remove`, `clear` and `open`, and a list page. `--minimal` writes only `services/list.ts`,
  `events.ts` and `actions/add.ts`: no page and no link.
- The templates are a starting point. Replace their bodies, placeholder subtitles ("Edit this
  page in ...") and tutorial comments with the real feature, and delete files it does not need.
- Names start with a lowercase letter and use lowercase letters, digits and single hyphens
  (`about`, `release-notes`). Choose a name the app does not already own: the CLI refuses
  `settings`, `api`, `login` and `register` because those are app routes (`--minimal` skips this
  check), and `app` is the app's own plugin ID, so `bitakit generate` rejects it as a duplicate.
  `npx bitakit info` lists the existing plugin IDs.
- The CLI never overwrites. It stops when the folder or file already exists.
- Every `add plugin` mode also writes `AGENTS.md` and a `CLAUDE.md` importing it. Update the
  plugin's local guide as its starter becomes a feature; see [plugin-guides.md](plugin-guides.md).

## Folder = feature, file path = ID

Everything for one feature lives in `src/plugins/<name>/`. Discovery derives IDs and URLs from
file paths, so there is nothing to register.

| File in `src/plugins/...`                     | Becomes                         |
| --------------------------------------------- | ------------------------------- |
| `about/actions/open.ts`                       | Action `about.open`             |
| `todos/services/list.ts`                      | Service `todos.list`            |
| `about/ui/pages/index.tsx`                    | Page `/about`                   |
| `about/ui/pages/team.tsx` or `team/index.tsx` | Page `/about/team`              |
| `todos/ui/pages/[id].tsx`                     | Page `/todos/<id>`, `params.id` |

- Dots and folders mean the same: `ui/pages/team.history.tsx` equals `ui/pages/team/history.tsx`.
- Every file with a default export under `ui/pages/` becomes a page (a `-` name prefix excludes
  a file). Put shared components in `ui/components/`, which discovery treats as ordinary imports.
- Renaming a file changes its ID or URL. Update the `href`s and `<Action id>`s that use it.

## Folders or flat files

Folders are the default, and `bitakit add` writes them. A flat layout is just as valid, because a
dot means the same as a folder. These all declare the Action `todos.add`:

| Layout               | File in `src/plugins/todos/`             |
| -------------------- | ---------------------------------------- |
| Folder (default)     | `actions/add.ts`                         |
| Flat file            | `actions.add.ts`                         |
| One file for several | `actions.ts` exporting `{ add, remove }` |

- The same works for `services`, `configs`, `slots` and `interceptors`, and for pages inside
  `ui/pages/`. React files always stay under `ui/`.
- `events.ts`, `settings.ts`, `setup.ts` and `plugin.config.ts` are one file per plugin in
  either layout. Every file and folder is optional: add only what the feature needs.
- Follow the layout the app already uses. When the user prefers flat files, write them by hand
  with the same content `bitakit add` would generate. Both layouts may be mixed; one ID needs
  exactly one file, so two spellings of the same ID fail as a duplicate.
- Folders keep a growing feature tidy and each change in its own file; flat files keep a small
  plugin visible at a glance. Moving between them never changes an ID.
- Do not run `bitakit migrate` on a flat app: it is the 0.1 upgrade and moves dotted files into
  folders.

## Add a page

```sh
npx bitakit add page about/team
```

This writes `src/plugins/about/ui/pages/team.tsx` for `/about/team`; nested names such as
`about/team/history` work too. The plugin's root page is `ui/pages/index.tsx`:

```tsx
'use client';
import { PageHeader } from '@bitakit/ui/components';

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="About" subtitle="What this app is for and who builds it." />
      <p className="text-sm text-muted-foreground">This app keeps a short list of things to do.</p>
    </div>
  );
}
```

- Start every file under `ui/` with `'use client'`. The page is the default export.
- `PageHeader` renders the page's heading: `title`, optional `subtitle`, and `trailing` for
  page-level buttons. Build the rest from `@bitakit/ui/components` (`Button`, `Input`, `Badge`,
  `Separator`, ...) and theme classes such as `text-muted-foreground`; layout with flex and gap.
- Bind each button that runs an operation to its Action (`<Action id="todos.add"><Button /></Action>`)
  and read service state with `useServiceState`, as `todos/ui/pages/index.tsx` does.

## Read a URL parameter

`bitakit add page` accepts plain names only, so create a parameter page by hand:
`src/plugins/todos/ui/pages/[id].tsx`.

```tsx
'use client';
import { useServiceState } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

// Served at /todos/<id>; URL parameters are always strings, so convert before comparing.
export default function TodoPage({ params }: { params: { id: string } }) {
  const todo = useServiceState('todos.list', (state) =>
    state.todos.find((candidate) => candidate.id === Number(params.id)),
  );
  return <PageHeader title={todo?.title ?? 'Todo not found'} subtitle={`Todo ${params.id}`} />;
}
```

- `PluginPage` passes the decoded segments as the `params` prop. Each `[name]` matches exactly
  one segment; catch-all and optional segments are not supported in plugin pages.
- An exact page wins over a parameter page: `ui/pages/new.tsx` serves `/todos/new` before `[id]`.
- Render a "not found" state yourself when the parameter matches nothing.

## Choose a layout

A page names its layout family with one export; the family's layout wraps the page:

```tsx
'use client';
import { PageHeader } from '@bitakit/ui/components';

// This page renders without the sidebar and header, with the normal page spacing.
export const layout = 'full-page';

export default function AboutTeamPage() {
  return <PageHeader title="Team" subtitle="The people behind this app." />;
}
```

- Values: no export or `'app'` for the normal frame, `'blank'` for a bare page, Shell's
  `'auth'`, `'error'` and `'full-page'`, or a family of the app such as `'onboarding'`
  (`src/layouts/onboarding.tsx`). An unknown name stops startup with an error that names the
  files to add and the known families.
- Shell's `AppShell` applies the choice. In an app without Shell, read its layout before relying
  on `export const layout`.
- To change how a family looks, replace its layout: `npx bitakit add layout full-page` writes
  `src/layouts/full-page.tsx`, which wins over Shell's default. Variants, choosing between them
  and replacing the whole frame are in [layouts-and-screens.md](layouts-and-screens.md).

## Link the page in the sidebar

`src/plugins/about/actions/open.ts`:

```ts
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'About',
  href: '/about',
  groups: ['navigation'],
  slots: ['shell.navigation'],
});
```

- `slots: ['shell.navigation']` places the link; `groups` is only a logical query. Shell renders
  an Action with `href` as a native link, labelled by `title`.
- `src/configs/shell.ts` names the navigation slot (`navigationSlot: 'shell.navigation'`). Other
  placements, such as `shell.toolbar` or a plugin's own Action slot, are in [slots.md](slots.md).
- `npx bitakit doctor` warns when a link's `href` has no page or app route.

## Plugin pages and app routes

- The catch-all route `src/app/(app)/[...path]/page.tsx` renders `<PluginPage>` inside
  `AppShell`. Plugin pages render in the browser once the BitaKit runtime is ready; the server
  sends no page content for them.
- Keep pages that need server rendering, Next.js `metadata`, server-side redirects or API route
  handlers as native routes in `src/app` (for example `src/app/(app)/pricing/page.tsx`).
- An app route at the same path wins over a plugin page; doctor reports it as an error.
- Check with `npm run typecheck` (it runs `bitakit generate`) and `npx bitakit doctor`, which
  confirms that every plugin page can be reached and every navigation link has a page.

## Explain it to the user

Say which plugin owns the page (`src/plugins/about`), that its URL comes from the file
`ui/pages/index.tsx` (`/about`), and that the sidebar entry is the Action `about.open` placed in
Shell's `shell.navigation` slot. To try it: start the dev server, click "About" in the navigation (the
sidebar, or the top bar in Shell's navbar layout) or open `/about`.
