# Interceptors

Use an interceptor to block an Action run at the last moment, to observe Action runs across
plugins, or to watch calls to a service method, without editing the Action or service itself.

## Block an Action run

```bash
npx bitakit add interceptor todos/no-duplicates
```

The command writes `src/plugins/todos/interceptors/no-duplicates.ts` with a logging template that
observes `todos.*`. Replace its body:

```ts
import { defineInterceptor } from '@bitakit/core';

export default defineInterceptor({
  action: 'todos.add',
  before: ({ input, services }) => {
    const title = String(input ?? '')
      .trim()
      .toLowerCase();
    // Returning false skips the run; any other value lets it continue.
    return !services.todos.list.state
      .get()
      .todos.some((todo) => todo.title.toLowerCase() === title);
  },
});
```

- When `before` returns `false`, the caller receives `{ status: 'skipped', reason: 'intercepted' }`.
  The run shows no toast, throws no error and changes no Action state. A returned promise is
  awaited, and the control shows pending while it waits.
- `<Action onExecuted>` also fires for skipped runs. To keep the typed title after a blocked add,
  check the status in the sample page:
  `onExecuted={(result) => { if (result.status === 'completed') setTitle(''); }}`.
- Hook context: `id`, the raw `input` (typed `unknown`, so narrow it), `signal`, `get`, `update`,
  `services`, `config`, `app` and `translate`. Read settings with
  `app.settings.todos.limit.get()`. `app.events` only has `on`. The `settings` and `events`
  shortcuts of an Action's `execute` are not available here.
- `before` runs only for a visible, enabled Action. If it throws, the run fails and `onError`
  receives the error, so return `false` to block a run quietly.
- This is a client execution rule. Keep server authorization on the server.

## Watch Actions of another plugin

```bash
npx bitakit add interceptor activity/todo-errors
```

`src/plugins/activity/interceptors/todo-errors.ts`:

```ts
import { defineInterceptor } from '@bitakit/core';

export default defineInterceptor({
  action: 'todos.*',
  // Without this, an interceptor only sees the Actions of its own plugin (activity).
  scope: 'global',
  after: ({ id, input }) => console.info('[activity] done', id, input),
  onError: ({ id, error }) => console.error('[activity] failed', id, error),
});
```

- `scope: 'plugin'` is the default for plugin interceptors and matches only Actions that the
  same plugin registered, even when `action` names another plugin's ID. Set `scope: 'global'` to
  reach other plugins.
- `action` takes one ID, a list of IDs, an ID prefix such as `'todos.*'`, or `'*'`. Omit it to
  match every Action of the same plugin. Patterns match Action IDs, not `groups`.
- `after` receives `result`, the value returned by `execute`, for completed runs. `onError`
  receives `error` for failed runs. Skipped runs reach neither hook. The return values and
  promises of these hooks never change the outcome, and their own errors are only logged.
- `order` (default `0`) sorts all Action interceptors, lowest first. The first `before` that
  returns `false` stops the remaining interceptors.
- `requires: ['todos.list']` makes startup fail with a clear message when that service is
  missing. `npx bitakit doctor` checks these names.

## Add an app-wide interceptor

`bitakit add` has no app-level target. To add one, create `src/interceptors/action-log.ts`:

```ts
import { defineInterceptor } from '@bitakit/core';

export default defineInterceptor({
  action: '*',
  after: ({ id }) => console.info('[action-log]', id),
});
```

- Files in `src/interceptors/` are global by default. Set `scope: 'plugin'` to limit one of them
  to the app's own `src/actions`.
- All app interceptors are active by default. To select some of them, list their file names in
  `bitakit.config.ts` next to `package.json` (create it if the app has none):

  ```ts
  import { defineBitaKit } from '@bitakit/discovery';

  export default defineBitaKit({
    interceptors: { enabled: ['action-log'] },
  });
  ```

  A name without a matching file stops `bitakit generate`. This list never affects plugin
  interceptors.

- Put rules that belong to one feature in that feature's plugin folder so the rule is removed
  together with the plugin.

## Observe a service method

```bash
npx bitakit add interceptor todos/trace-list
```

Replace the template in `src/plugins/todos/interceptors/trace-list.ts`:

```ts
import { defineInterceptor } from '@bitakit/core';

export default [
  defineInterceptor({
    service: 'todos.list',
    method: 'add',
    after: ({ args }) => console.info('[todos] added', args[0]),
  }),
  defineInterceptor({
    service: 'todos.list',
    method: 'clear',
    before: () => console.info('[todos] clearing'),
  }),
];
```

- Service hooks only observe. They receive `service`, `method` and `args`, plus the awaited
  `result` or the `error`, and cannot block a call or change it. Leave `args` and `result`
  unchanged.
- They see every call made through the service container, from Actions, pages and other
  services. They do not see a service calling its own methods internally.
- Each definition targets either `action` or `service`. Setting both throws. To cover several
  targets, default-export an array as above.
- Omit `method` to observe every public method. `service: 'todos.*'` matches a name prefix.
  Hooks run synchronously, and their promises are ignored.

## Choose an interceptor, `enabled`, `execute` or an event

- For a rule the user should see before clicking, such as a disabled button, use the owner's
  Action `enabled`. The sample `todos.add` already checks `todos.limit` there.
- For a rule that is part of the operation itself, put it in `execute` or in the service method.
- Use an interceptor for a rule over Actions you do not own, a rule shared by many Actions, or a
  check that must run asynchronously at execution time.
- To react to a change, listen to the owner's event, as `activity` does with `todos.changed`.
  Use an interceptor's `after` only when the owner emits no event.

## Explain it to the user

- Say which plugin owns the interceptor (for example "todos, in
  `src/plugins/todos/interceptors/no-duplicates.ts`") and which Action ID or service it targets.
  If it uses `scope: 'global'`, say that it reaches Actions of other plugins.
- Say what the user will notice. A blocked run does nothing visible: the todo is not added and
  no message appears. Observers only write to the browser console.
- To try it, open `/todos`, add "Milk" twice and see that only one appears. For an observer, open
  the browser console and add or clear a todo.
