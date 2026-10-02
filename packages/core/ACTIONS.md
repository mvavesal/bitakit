# Actions

Define an action, register it, bind a control. State and execution are shared by every binding.

This guide covers the low-level action primitives in `@bitakit/core/actions` and their React
bindings in `@bitakit/ui`. In an app, discovery and the runtime do the registration for you:
write `defineAction({ ... })` in `actions/<name>.ts` and bind it. Read on when you compose
an ActionList yourself or build a renderer.

## 1. Define behavior

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Say hello',
  description: 'Shows a greeting.',
  enabled: ({ input }) => typeof input === 'string' && input.length > 0,
  execute: ({ input }) => window.alert(input),
});
```

`title`, `description`, `tooltip`, `icon`, `variant`, `href`, `enabled`, `visible`, `checked`
and `value` accept a value or a function of `{ input, services, config, app }`. The runtime
evaluates functions per binding input and re-evaluates them when a store they read changes.
Whatever `execute` returns becomes `value` of the completed execution result. An async
`execute` shares its pending state with every binding.

Pass an `input` schema (zod, valibot or any Standard Schema) instead of a type argument to
validate the input and disable the action while the current input is invalid. `href` makes a
navigation action, `dialog` opens a component in the host dialog, `confirm` asks first,
`concurrency` chooses `exclusive` (default), `per-input` or `latest`, and `success`/`failure`
describe the feedback. The [Core reference](docs/reference.md) lists every field.

## 2. Register and provide

The runtime registers discovered actions and `FoundationProvider` owns the root
`ActionProvider`. Standalone React code or a test can own a list directly:

```tsx
import { useState } from 'react';
import { ActionProvider, createActionList } from '@bitakit/ui/actions';

function createAppActions() {
  const actions = createActionList();
  actions.register({
    id: 'message',
    title: 'Say hello',
    execute: ({ input }) => window.alert(String(input)),
  });
  actions.register({ id: 'settings', title: 'Settings', href: '/settings' });
  return actions;
}

function Root() {
  const [actions] = useState(createAppActions);
  return (
    <ActionProvider actions={actions}>
      <App />
    </ActionProvider>
  );
}
```

`register` takes the low-level `ActionDefinition` (`id` and `title` are required) and returns
a handle with `get`, `update`, `onDispose` and `unregister`. Unregistration is
ownership-safe, including late async completion. Lists are independent; no global state.

`ActionProvider` supplies browser navigation by default. Framework adapters pass `navigate`,
`Link` and `pathname` from the app's router; `controls` maps control state to the prop names
of your component library (`{ button: (state) => ({ isDisabled: state.disabled }) }`). No
router logic belongs in an action or a bootstrap effect.

## 3. Bind UI

```tsx
import { Action, ActionButton, ActionLink } from '@bitakit/ui';

<Action id="message" input="Hello!"><Button /></Action>
<Action id="message" input="Hello!"><MyButton variant="outline">Greet</MyButton></Action>
<ActionButton action="message" input="Hello!" as={MyButton} />
<ActionLink action="settings" />
```

`<Action>` merges the control props into its child: handlers are chained, class names
joined and `disabled` combined. An empty child receives the action's icon and title. The
`kind` prop selects the prop set (`button`, `link`, `toggle`, `choice`, `menuItem`); the
default is `link` for actions with an `href`, otherwise `button`. A render function gives
full control: `<Action id="message">{(control) => ...}</Action>`. `ActionButton` and
`ActionLink` are sugar on top of `<Action>`.

Custom components forward ordinary props, including `onClick`, `disabled`, aria attributes,
children and refs. The package uses native elements by default and has no styling or
icon-library dependency.

### Toggles, choices and your own control

```tsx
const preview = useAction('preview');       // checked / onCheckedChange
const theme = useAction('theme');           // value / onValueChange

<Switch {...preview?.checkedProps()} />
<RadioGroup {...theme?.valueProps()}>…</RadioGroup>
```

`useAction(id, input)` returns the resolved control state for `input` (`title`, `enabled`,
`visible`, `pending`, `disabled`, `checked`, `value`, `href`, `icon`, `status`, `error`, …), a
guarded `execute(input?)` and prop getters: `props()` for buttons, `linkProps()` for anchors,
`checkedProps()` for checkboxes and switches, `valueProps()` for selects and radio groups and
`menuItemProps()` for menu items. Getters accept `{ onError, onExecuted }`. It returns
`undefined` while the action is not registered.

```tsx
const action = useAction('message', 'Hello');
if (!action?.visible) return null;
return <button {...action.props()}>{action.title}</button>;
```

The hook's `execute` always uses the list's guards and pending/error lifecycle. Execution
resolves to `{ status: 'completed', value }` or `{ status: 'skipped', reason }`; rejections
carry the handler error. `pending` is per input for `per-input` actions.

## 4. Groups and menus

```tsx
import { ActionMenu, useActionGroup } from '@bitakit/ui';

<ActionMenu group="organization.member.menu" label="More" input={member} />;

function Toolbar() {
  const bulk = useActionGroup('todos.bulk');
  return bulk.items.map((item) => (
    <button key={item.id} {...item.props()}>
      {item.title}
    </button>
  ));
}
```

`groups: ['todos.bulk']` on a definition puts an action in a group; `useActionGroup(group,
input?)` returns the current visible members as controls bound to `input`, ordered by
`order` then ID, and `useActionGroups([...])` several groups at once. Hidden items and empty
groups disappear. Group IDs are presentation grouping, not namespaces for action IDs.
Updating an action updates every mounted view; resolving one row never changes another.

## 5. Interception and logging

```ts
const stopCheck = actions.use({
  async before(context) {
    return await confirmIfNeeded(context); // false cancels
  },
});
const stopObserving = actions.subscribeExecution((event) => {
  // started / completed / skipped / failed; do not log private input by default.
  recordOutcome({ action: event.id, phase: event.phase, time: event.timestamp });
});
stopCheck();
stopObserving();
```

Guards and registration ownership are checked again after awaiting interceptors. Observer
errors cannot turn a completed mutation into a failure. The stream is an application
integration point, not a durable or trusted server audit trail. In apps, write
`defineInterceptor({ action: 'todos.*', before, after, onError })` in `interceptors/` instead.

## 6. Typed action IDs

`ActionMap` is an augmentable interface keyed by action ID with `{ input, result }` per entry.
Discovery generates it from the discovered definitions; explicit hosts and packages augment
it themselves:

```ts
declare module '@bitakit/core' {
  interface ActionMap {
    'members.promote': { input: MemberContext; result: void };
  }
  interface ActionMapOptions {
    strict: true;
  } // reject unknown IDs at compile time
}
useAction('members.promote')?.execute({ memberId }); // input and result are typed
list.execute('members.promote', { memberId });
```

Generated apps turn strict IDs on by default (`strict: false` in `bitakit.config.ts` turns
them off). Types never replace runtime validation of input that arrives from the network.

Registrations marked `internal: true` remain executable and subscribable by ID but are
hidden from `useActions()`, groups, shortcuts and typed references; pass
`useActions({ internal: true })` to enumerate everything.

### Source map

- `action-list.ts`: registration, updates and ownership.
- `execution.ts`: invocation guards, concurrency and the pending lifecycle.
- `interceptors.ts`: cancellable pre-execution checks and outcome subscriptions.
- `groups.ts`: typed placement groups.
- `navigation.ts`: safe hrefs and the navigation host.
- `action.ts`, `base/url-action.ts`: the `Action` class, a library primitive for integrations.
- `feedback.ts`: `ActionFailure` and feedback evaluation.
- `types.ts`: shared contracts; `core.ts`: non-React exports.
- `@bitakit/ui`: `hooks/use-action.ts`, `hooks/use-action-group.ts`, `components/action.tsx`, `providers/action-provider.tsx`.
