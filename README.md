<p align="center">
  <img src="packages/core/assets/bitakit-banner.png" alt="BitaKit — Your app. Your building blocks. A modular castle assembled from stairs, walls, and towers." width="1024">
</p>

<h1 align="center">Build your app bit by bit.</h1>

<p align="center">
  <b>Plug in features. Pair with AI. Ship with confidence.</b><br>
  BitaKit is the AI-friendly composition layer for Next.js and TanStack Start.<br>
  Break your product into clean plugins and grow it one building block at a time.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@bitakit/core"><img src="https://img.shields.io/npm/v/@bitakit/core?label=%40bitakit%2Fcore&logo=npm&logoColor=122F4D&labelColor=E8EEF5&color=C9D6E6" alt="npm version of @bitakit/core"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-DBCAF6?logo=opensourceinitiative&logoColor=6234B2&labelColor=F0E8FC" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/TypeScript-first-CADFF6?logo=typescript&logoColor=346FB2&labelColor=E8F2FC" alt="TypeScript first">
  <img src="https://img.shields.io/badge/Next.js-supported-CAF6DB?logo=nextdotjs&logoColor=1F2328&labelColor=E8FCF0" alt="Next.js supported">
  <img src="https://img.shields.io/badge/TanStack%20Start-experimental-F6DDCA?logo=tanstack&logoColor=B26A34&labelColor=FCF1E8" alt="TanStack Start experimental">
</p>

<p align="center">
  <a href="#-from-zero-to-running-app-in-one-command">Quick start</a> ·
  <a href="#-ship-features-with-your-ai-assistant">AI workflow</a> ·
  <a href="#-break-your-app-into-plugins">Plugins</a> ·
  <a href="packages/core/README.md">Core</a> ·
  <a href="packages/README.md">Packages</a>
</p>

> [!NOTE]
> **Early release.** The BitaKit packages and the app generator are on npm (0.1).
> This repository contains the next release, 0.2, which changes the plugin API described
> below; it is not on npm yet. APIs are still evolving, and TanStack Start support is
> experimental.

## ⚡ From zero to running app in one command

```sh
npx @bitakit/create-app my-app
```

Pick **Next.js** or **TanStack Start**, tick the extras you want — an app shell with
settings pages, ⌘K quick search — and start building. Your pages stay plain framework routes.
No lock-in, no magic folder you can't leave.

## Why BitaKit?

Every app starts clean. Then the features pile up. Imports tangle, every new button
needs wiring in five places, and both your new teammate and your AI assistant get lost
in the sprawl.

**BitaKit gives every feature a home.** A plugin groups it, services hold its behavior
and state, actions expose it to your UI, events tell other plugins what happened, and
configs give it defaults your app can override. Same shape, every time.

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🤖 Pair with AI, minus the chaos</h3>
      Predictable folders and typed contracts give your coding assistant precise context:
      where a feature lives, what it needs, and what it exposes. Ask for a change,
      get a small, focused diff you can actually review.
    </td>
    <td width="50%" valign="top">
      <h3>🧩 Your app, in plugins</h3>
      Split your product into self-contained plugins that own their services, actions
      and events. Teams — and agents — work side by side without stepping on each other.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🧱 Grow bit by bit</h3>
      Start with headless Core. Add an app shell, settings, search, authentication,
      organizations, translations or email when your product needs them — not before.
    </td>
    <td width="50%" valign="top">
      <h3>🔌 Less wiring, more building</h3>
      Drop a file into the right folder. Build-time discovery generates the imports,
      registration and types. No hand-kept registries. No provider soup.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🛡️ Type-safe from definition to button</h3>
      Service methods, action inputs and results, and event payloads carry their types
      all the way to the call site. Strict action IDs are on by default in generated apps.
    </td>
    <td width="50%" valign="top">
      <h3>🏠 Your stack stays yours</h3>
      Keep your routes, components, design system and backend. BitaKit composes your
      features; it never takes over routing, rendering or deployment.
    </td>
  </tr>
</table>

## 🤖 Ship features with your AI assistant

BitaKit's conventions double as a map for AI. Every feature has the same shape, so an
assistant knows exactly where new code belongs — and you know exactly what to review.

> **You:** Add a delete action to the todos plugin. Disable it while the list is empty.

```text
src/plugins/todos/
├── services/
│   └── tasks.ts      ✏️  adds remove()
└── actions/
    ├── create.ts
    └── delete.ts     ✨  new — discovered as todos.delete
```

```ts
// src/plugins/todos/actions/delete.ts
import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Delete',

  // Re-evaluated whenever the tasks store changes: disabled while the list is empty.
  enabled: ({ services }) => services.todos.tasks.state.get().items.length > 0,

  // Runs when a bound control or your code executes "todos.delete".
  execute: ({ services, input }) => services.todos.tasks.remove(input),
});
```

<details>
<summary><b>The matching service change</b> — one new method</summary>

```diff
 export default defineService(({ store }) => {
   const state = store<{ items: Task[] }>({ items: [] });

   return {
     state,
     add(title: string) {
       state.set((s) => ({ items: [...s.items, { id: Date.now(), title }] }));
     },
+
+    remove(id: number) {
+      state.set((s) => ({ items: s.items.filter((task) => task.id !== id) }));
+    },
   };
 });
```

</details>

No registry to update. No provider to touch. No subscription to clean up.
**The diff is as small as the idea.** Every button bound to `todos.delete` disables
itself while the list is empty — without a single extra line of UI code.

> [!TIP]
> Presentation fields such as `enabled`, `visible` and `title` take a value or a
> function. A function reads the current input and services, and Core re-runs it
> whenever a store it reads changes.

The same clarity helps human reviewers: one feature, one folder, explicit dependencies.
Tests and review stay part of your workflow; BitaKit just makes them easier to focus.

## 🧩 Break your app into plugins

A plugin is a feature in a folder. Write your own, install ready-made ones, and snap
them onto Core — it starts them, checks their dependencies and cleans them up.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/architecture-dark.svg">
    <img src="docs/assets/readme/architecture-light.svg" width="880" alt="BitaKit architecture. Your pages and components bind actions in BitaKit Core. Your plugins (todos, billing, reports) and optional BitaKit plugins (shell, settings, search, auth, i18n) snap onto Core, which owns services, actions, events, configs, overrides and interceptors. Below Core, the framework adapter discovers src/plugins at build time and generates registration and types.">
  </picture>
</p>

Your framework keeps routes and rendering. Plugins share behavior through typed
services, actions and events instead of reaching into each other's internals.

**Install a plugin, get a feature.** In a Shell app, `npm install @bitakit/quick-search`
adds a ⌘K search for your app's navigation to the app bar — no provider, no registry,
no glue code.

**Share plugins like packages.** Plugins can live in your app or in their own
repositories. Published plugins connect through the same public contracts.

## 🧱 Grow at your own pace

Start small. Add capabilities one building block at a time. Every package except Core
is optional.

| When you need…            | Add                                                                           | You get                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A clean feature structure | `@bitakit/core`                                                               | Plugins, services, actions, events, configs and interceptors — Node or browser |
| React and your framework  | `@bitakit/ui` · `@bitakit/next` or `@bitakit/tanstack`                        | `<Action>`, hooks, build-time discovery and typed IDs                          |
| An application frame      | `@bitakit/shell` · `@bitakit/app-preferences`                                 | Layout, navigation, settings pages and saved preferences                       |
| Fast navigation           | `@bitakit/quick-search`                                                       | ⌘K search across your app's navigation                                         |
| Users and teams           | `@bitakit/better-auth` · `@bitakit/better-auth-ui` · `@bitakit/organizations` | Authentication, account screens and organizations                              |
| More languages            | `@bitakit/next-intl`                                                          | Translations and a language preference                                         |
| Email                     | `@bitakit/email` · `@bitakit/nodemailer`                                      | A provider-independent sending contract with SMTP delivery                     |

## 🚀 Build your first feature

Create an app, add a To-do plugin, and bind an action to your interface.

### 1. Create your app

```sh
npx @bitakit/create-app my-app --framework next --features none --yes
cd my-app
npm run dev
```

Open http://localhost:3000: you see **Welcome**. This walkthrough uses Next.js without
extras, so the files below match your project exactly. The generator connects the
BitaKit provider and build-time discovery; your pages and routes remain ordinary
Next.js files.

### 2. Add a plugin folder

```text
src/
├── app/
│   ├── layout.tsx
│   └── page.tsx
└── plugins/
    └── todos/
        ├── services/
        │   └── tasks.ts
        └── actions/
            └── create.ts
```

A **service** owns the tasks. An **action** exposes an operation to your UI. The plugin
folder groups them into one feature. (`npx bitakit add plugin todos` scaffolds a
complete plugin for you; here we write the two files by hand to see how they fit.)

### 3. Define the service

`src/plugins/todos/services/tasks.ts`

```ts
import { defineService } from '@bitakit/core';

export type Task = { id: number; title: string };

export default defineService(({ store }) => {
  // Observable state: actions and pages follow it without any wiring.
  const state = store<{ items: Task[] }>({ items: [] });

  return {
    state,
    add(title: string) {
      state.set((s) => ({ items: [...s.items, { id: Date.now(), title }] }));
    },
  };
});
```

Core creates the service when the plugin starts. `store()` holds the tasks in memory,
so a page reload starts empty; replace the body with calls to your API when you are
ready.

### 4. Define the action

`src/plugins/todos/actions/create.ts`

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add a task',
  // Runs when a bound control or your code executes "todos.create".
  execute: ({ services, input }) => services.todos.tasks.add(input),
});
```

`defineAction<string>` declares the input: the task title. Services are reached as
`services.<plugin>.<file>`, and TypeScript knows the methods of `services.todos.tasks`.

### 5. Let discovery connect the feature

Discovery finds the files and generates their imports, registration and types into
`src/bitakit.gen.tsx` while the dev server runs:

| Contribution         | Discovered identity                                      |
| -------------------- | -------------------------------------------------------- |
| `src/plugins/todos/` | Plugin `todos`                                           |
| `services/tasks.ts`  | Service `todos.tasks`, reached as `services.todos.tasks` |
| `actions/create.ts`  | Action `todos.create`                                    |

No handwritten import list. A service from another plugin can be listed in an action's
`requires`, so a missing plugin is reported at startup. See
[how discovery works](docs/concepts/discovery.md).

### 6. Bind the action to your UI

`src/app/page.tsx`

```tsx
'use client';

import { Action } from '@bitakit/ui';

export default function Page() {
  return (
    <main>
      <h1>My tasks</h1>

      <Action id="todos.create" input="New task">
        <button />
      </Action>
    </main>
  );
}
```

You see an **Add a task** button. `<Action>` merges the action into its child: the label
is the action's title, each click adds **New task** through the action, and the button
disables itself while the action runs or is disabled — no click handler required. Put
your own component inside, such as `<Button />` from your design system.

### 7. Show the tasks

The service's `store()` is observable, so a page can read it directly:

```tsx
'use client';

import { Action, useServiceState } from '@bitakit/ui';

export default function Page() {
  // Re-renders whenever the tasks store changes.
  const tasks = useServiceState('todos.tasks', (state) => state.items, []);

  return (
    <main>
      <h1>My tasks</h1>

      <Action id="todos.create" input="New task">
        <button />
      </Action>

      <ul>
        {tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </main>
  );
}
```

Each click now adds a **New task** line to the list. No event, no subscription and no
cleanup: the hook follows the store and releases itself with the page. For a
framework-free version with three actions, follow the
[To-do tutorial](packages/core/docs/todo-tutorial.md).

**Your framework renders the page. Your plugin defines the feature. BitaKit connects the parts.**

## 🔍 Under the hood

One action, every entry point. Here is the `todos.delete` action from above at runtime:

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/action-loop-dark.svg">
    <img src="docs/assets/readme/action-loop-light.svg" width="880" alt="Action loop. 1: a button, menu item or shortcut executes todos.delete. 2: the action calls tasks.remove(). 3: the service updates its store. 4: the store change re-evaluates the action's enabled function. 5: every bound control receives the new state.">
  </picture>
</p>

The service owns the data in a store, and the action's `enabled` function decides what
that data means for its controls. Core re-evaluates every function-valued field when a
store changes and keeps every binding in sync. It runs in Node and the browser without
React, and it never persists data for you: storage stays your choice.

## 📚 Learn the ideas

- **[How does discovery work?](docs/concepts/discovery.md)** File conventions in, registration and types out.
- **[Why actions?](docs/concepts/actions.md)** One operation, shared by buttons, menus and links.
- **[What is a service?](docs/concepts/services.md)** Behavior and observable state with an owner.
- **[Configuration or user preferences?](docs/concepts/configuration-and-preferences.md)** What Core owns and what settings packages add.
- **[Events](packages/core/docs/events.md)** Typed notifications between plugins.
- **[Type safety](apps/docs/content/docs/concepts/type-safety.mdx)** How types travel from definitions to callers.
- **[Build a To-do plugin](packages/core/docs/todo-tutorial.md)** Follow one feature from definition to execution.

## 🧭 Honest boundaries

- TanStack Start support is **experimental**; see its [verified scope](packages/tanstack/README.md).
- Plugins run in the browser today. Server-side plugin halves (route handlers, jobs) are planned, not shipped.
- Plugins are trusted application code. Discovery is not a marketplace, remote installer or sandbox.
- `store()` is in-memory state. Services don't persist data on their own — you choose storage.
- TypeScript checks your code; validate external input and authorize requests on the server.

## Explore the documentation locally

Requirements: **Node.js 24** and **npm 10 or newer**.

```sh
git clone https://github.com/mvavesal/bitakit.git
cd bitakit
npm ci
npm run dev:docs
```

Open [localhost:3002/docs](http://localhost:3002/docs) for searchable guides. The
repository is currently private, so cloning requires access. Hosted documentation
is being prepared.

<details>
<summary><b>Repository map</b></summary>

| Directory                            | Purpose                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| `packages/core`                      | Framework-independent runtime, Actions and Node-only discovery |
| `packages/ui`                        | React bindings and optional standard components                |
| `packages/next`, `packages/tanstack` | Optional framework integrations                                |
| `packages/cli`                       | The `bitakit` command: add, generate, migrate, doctor, build   |
| `packages/create-app`                | Frontend generator                                             |
| Other `packages/*`                   | Optional capabilities and provider integrations                |
| `apps/docs`                          | Developer documentation                                        |
| `docs`                               | Architecture notes and roadmap                                 |
| `scripts`                            | Workspace and verification tools                               |

See the [package guide](packages/README.md) for individual responsibilities.

</details>

## Contributing and licensing

Keep changes focused, preserve the package boundaries, and document public behavior
in English. Start with the [contributor guide](apps/docs/content/docs/contributing.mdx)
and the nearest `AGENTS.md` — it guides human contributors and coding assistants alike.

BitaKit is licensed under the [MIT License](LICENSE). Third-party components retain
their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

<p align="center">
  <b>Your app. Your building blocks. Built bit by bit.</b>
</p>
