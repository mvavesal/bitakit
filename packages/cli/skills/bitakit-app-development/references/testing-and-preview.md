# Check the work: typecheck, doctor, tests and preview

Use this after every change and before telling the user it works. Report only the checks you
actually ran.

## Run typecheck and doctor (always)

```sh
npm run typecheck
npx bitakit doctor --json
```

- In a create-app app, `npm run typecheck` runs `bitakit generate`, the framework's type
  generation (`next typegen` or `tsr generate`) and `tsc --noEmit`. Without that script, run the
  same three steps yourself: `npx bitakit generate`, the framework step, `npx tsc --noEmit`.
- Doctor prints `{ project, results: [{ status, title, details?, fix? }], errors, warnings }`.
  `status` is `ok`, `warn` or `error`; `details` is a list of strings. It exits 1 when `errors` is
  above 0; warnings keep exit 0. Apply the `fix` it names before guessing.
- Doctor checks wiring statically (versions, provider, routes, links, service names, styles, slot
  file targets). It renders nothing.
- When the starting state is unknown, run both before editing, so an existing error is not
  blamed on your change.

## Add a test runner (ask first)

Generated apps have no test runner and no `test` script. Tell the user, and ask before adding
test files or dependencies. When they agree, generate the first test:

```sh
npx bitakit add test <plugin>
```

- It writes `tests/<plugin>.test.ts` at the app root, which mounts the plugin, checks that it
  starts, then stops it. A Shell stand-in is included when the plugin's Actions use `shell.*` slots.
- It prints the setup the app still lacks as commands (dev dependencies, `type`, `test` script).
  Run them, then `npm test`, and add the behavior to check, as in the activity test below.

Manual setup, for a test written by hand:

```sh
npm install --save-dev @bitakit/discovery jiti typescript @types/node
```

- Use Node.js 24 or newer. Node strips the types; `npm run typecheck` still checks the test files.
- Add `"type": "module"` to `package.json`. Without it Node runs the test but prints a
  `MODULE_TYPELESS_PACKAGE_JSON` warning.
- Add the script `"test": "node --test tests/*.test.ts"` and run it from the app root: plugin
  folder paths resolve against the current directory.
- A create-app app already lists `@bitakit/discovery`, `typescript` and `@types/node`; `jiti` is
  only present transitively, so add it.

## Test a plugin headlessly

File: `tests/activity.test.ts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineContract, definePlugin, defineSlot, getService } from '@bitakit/core';
import { mountPlugin } from '@bitakit/core/testing';
import type feed from '../src/plugins/activity/services/feed';

const feedService = defineContract('activity.feed').of<ReturnType<typeof feed.create>>();
// todos.open targets shell.navigation; this stand-in owns that slot so startup succeeds without Shell.
const shell = definePlugin({
  id: 'shell',
  slots: { navigation: defineSlot({ accepts: 'actions' }) },
});

test('adding a todo is recorded in the activity feed', async () => {
  const plugin = await mountPlugin('src/plugins/activity', {
    plugins: ['src/plugins/todos', shell],
  });
  try {
    const result = await plugin.execute('todos.add', 'Buy milk');
    assert.equal(result.status, 'completed');
    assert.deepEqual(plugin.events.recorded.at(-1), {
      type: 'todos.changed',
      data: { kind: 'added', title: 'Buy milk' },
    });
    assert.deepEqual(getService(plugin.services, feedService).state.get().entries, [
      'Added "Buy milk"',
    ]);
  } finally {
    await plugin.stop();
  }
});
```

- `mountPlugin(folder, { plugins, services, configOverrides })` discovers the folder like the app
  does, skips `ui/` and resolves after startup. `plugins` takes folder paths or `definePlugin`
  stubs; `services` supplies host services such as a fake `auth`.
- `plugin.execute('add')` prefixes the mounted plugin's ID; for another plugin's Action pass the
  full ID (`todos.add`). The result has `status: 'completed'` on success.
- Read state through `defineContract('<plugin>.<file>')` and `getService(plugin.services, key)`.
  The `import type` only borrows the service type; keep it without `.ts` so `tsc` accepts it and
  Node erases it.
- `plugin.events.recorded` holds `{ type, data }` for every event emitted while mounted. Always
  `await plugin.stop()` in `finally`.
- Without the Shell stub, startup fails with `Slot "shell.navigation": no owning definition
exists`. Add a stub only for slots the mounted plugins target. Keep services and Actions free
  of JSX; Node loads them without a bundler.

## Test React components

`renderWithBitaKit(element, { plugins, config, services, ui })` from `@bitakit/ui/testing` mounts
the provider and awaits readiness. Use it only when the project already has a DOM test setup
such as jsdom; the helper installs none. Otherwise verify the UI in the browser preview.

## Preview in the browser

Start the app's own dev script (`npm run dev`) as a long-running background process, wait for
its ready line and use the `Local:` URL it prints. The page path comes from `ui/pages`:
`src/plugins/todos/ui/pages/index.tsx` is `/todos`, `ui/pages/<path>.tsx` is `/<plugin>/<path>`.

In Claude Code desktop, the preview tool starts the server from `.claude/launch.json`. Create it
when missing:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

- In Codex and other hosts, use the available browser tool. Without one, check the page
  headlessly while the dev server runs:

  ```sh
  npx bitakit check-page /todos --json
  ```

  It opens the page in headless Chromium and reports the headings, an excerpt of `<main>`, the
  runtime state (`ready` when startup finished), `[bitakit]` errors, console and page errors
  and failed requests. Exit code 1 means it saw an error. Add `--base-url http://localhost:<port>`
  when the server uses another port. It needs Playwright in the project: when it exits with 2,
  ask the user before running the install commands it prints. It does not click, so give the
  user the clicks and the expected result and report interactions as not verified.

- An HTTP 200 or the server HTML proves nothing. The catch-all route
  `src/app/(app)/[...path]/page.tsx` answers every path, and plugin pages and slots render only
  after the runtime starts in the browser.
- An unknown path also answers 200 (with Shell it shows the heading "Page not found"), so confirm
  that the rendered headings name your page.
- Read the browser console. In development a plugin that fails to start is turned off and the
  rest keeps running: the console shows `[bitakit] <cause>` and a dialog says
  `Plugin "<id>" was turned off`. A page of that plugin may simply look empty.
- For an empty slot, confirm the visited page or layout renders that outlet (`PluginSlot` or
  `useSlot`), the file is `ui/slots/<slot name>.tsx`, and doctor's "Slot files target declared
  slots" passes. A custom `useSlot` renderer exposes `diagnostics.reason` and
  `diagnostics.excluded`.
- When the change depends on the Shell layout, check both layouts: Settings, Appearance,
  Navigation switches `shell.layout` between Sidebar and Navigation bar. `sidebar.*` slots do not
  render in the navbar layout.
- Example run: open `/todos`, type "Buy milk", press Enter. The list shows it and Recent activity
  shows `Added "Buy milk"`.

## Report the result

- Files changed, and the IDs involved (`todos.add`, `todos.list`, `todos.footer`, `todos.limit`).
- Where it appears: page path, slot, layout.
- Each check you ran and its exit code: typecheck, doctor (`errors`/`warnings`), tests.
- What you did not verify, such as the navbar layout or any UI without a browser.

## Explain it to the user

Say what ran and what it proved: "Typecheck and doctor pass; the activity test shows that adding
a todo emits `todos.changed` and the feed records it." Name the page to open and what to click,
then state plainly what was checked in a browser and what was not.
