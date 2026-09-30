# Actions

Define an action, register it, bind a control. State and execution are shared by every binding.

## Shared text and optional dependencies

Actions define `title` and `description` once. The host may supply `createActionList([], { project })` to project these texts for display without mutating their original values. The app uses `t.has(value) ? t(value) : value`: known translation keys are translated, other strings remain literal. `list.refresh()` updates subscribers after a locale change. Contextual presentation is projected too; the core has no locale-library dependency.

```ts
list.register({
  id: 'users.invite',
  title: 'users.invite.title',
  description: 'Invite someone to the team.',
  dependsOn: ['users.manage'], // optional: IDs in this same ActionList
  execute: inviteUser,
});
```

All prerequisites must exist and be effectively enabled. Missing actions, self-dependencies and cycles disable the dependent action until resolved. Transitive dependencies are supported. Dependencies never execute another action or overwrite its own `enabled` setting. Updates, registration and removal reactively invalidate dependent bindings; unrelated snapshots retain their identity.

`resolve(id, input)` checks prerequisites with the same invocation input and is checked again immediately before execution, including after asynchronous interceptors. Unbound snapshots evaluate prerequisite conditions without input. Contextual bindings use `resolve` through the existing hooks and group bindings. Visibility and pending are separate states and do not by themselves disable prerequisites. Guards must be pure; use `refresh()` if their external context changes independently. Without dependencies, behavior is unchanged.

## 1. Define behavior

```tsx
import { Action } from '@bitakit/ui/actions';

class ShowMessage extends Action<string> {
  execute(message: string) {
    window.alert(message);
  }
}
```

Title, description, icon, enabled, visible, checked and value are inherited. Assigning them updates subscribed controls. An async execute method automatically shares pending state. The method receives your input directly, plus the invocation context as an optional second argument (`execute(input, context)`): `context.update()` patches only this registration, `context.get()` reads the current snapshot. Whatever `execute` returns becomes `value` of the completed execution result.

Class actions registered through the foundation runtime may declare `success` and `failure` fields with the same feedback options as declarative definitions. Both are opt-in: without them the caller receives the raw error and no success message is shown.

## 2. Register and provide

```tsx
import { useState } from 'react';
import { createActionList, ActionProvider, URLAction } from '@bitakit/ui/actions';

function createAppActions() {
  const actions = createActionList();
  actions.add('message', new ShowMessage({ title: 'Say hello' }));
  actions.add('settings', new URLAction('/settings', { title: 'Settings' }));
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

For Next.js, import **ActionProvider from `@bitakit/next/actions`** instead. It supplies router navigation and Next links once. Other frameworks can supply the provider's `navigate` and `Link` props. The default uses browser navigation. No router logic belongs in an application action or bootstrap effect.

## 3. Bind UI

```tsx
import { ActionButton, ActionLink } from '@bitakit/ui/actions';

<ActionButton action="message" input="Hello!" />
<ActionButton action="message" input="Hello!" as={MyButton} />
<ActionLink action="settings" />
```

Custom buttons forward ordinary button props, including onClick, disabled, aria attributes, children and refs. No action code is required inside them. The package uses native elements by default and has no styling or icon-library dependency.

### Checkboxes, radio groups and cards

```tsx
class Preview extends Action<boolean> {
  execute(checked: boolean) { this.checked = checked; }
}
class SelectTheme extends Action<string> {
  async execute(value: string) {
    await saveTheme(value);
    this.value = value;
  }
}

<ActionCheckbox action="preview" as={MyCheckbox} />
<ActionRadioGroup action="theme" as={ThemeCards} options={[
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]} />
```

Checkbox components accept checked/onCheckedChange/disabled. Radio-group components accept value/onValueChange/disabled/options. Application components retain their own keyboard, focus and ARIA semantics.

For other prop names, map once using the shared binding:

```tsx
<ActionBinding action="theme" kind="choice" input="dark">
  {({ selected, disabled, pending, execute }) => (
    <MyCard selected={selected} disabled={disabled} busy={pending} onSelect={() => execute()}>
      Dark
    </MyCard>
  )}
</ActionBinding>
```

Binding manages visibility, execution guards, pending state and a default native title tooltip from description. The action owns its confirmed value; failed execution does not automatically change selection. A custom component must honor the props it receives.

### Your own control: one hook

```tsx
const action = useAction('message');
if (!action?.visible) return null;
return (
  <button
    disabled={!action.enabled || action.pending}
    onClick={() => action.execute('Hello').catch(showError)}
  >
    {action.title}
  </button>
);
```

The hook's execute method always uses the list's guards and pending/error lifecycle. Missing IDs return undefined. Do not call an instance's execute method directly from UI: that intentionally represents behavior alone, without list orchestration.

Execution resolves to `{ status: 'completed', value }` or `{ status: 'skipped', reason }`. Rejections carry the handler error. Action IDs autocomplete from `ActionMap`, and known IDs type both `input` and `value`; see below.

### Lifecycle and advanced integrations

`add(id, action)` returns a registration handle with update and unregister. Unregistration is ownership-safe, including late async completion. Lists are independent. Optional `useRegisterActions` handles page-owned definitions with cleanup; ordinary root actions need no registration hook.

An action may implement `connect()` to subscribe to an external application service and return cleanup. The provider owns this lifecycle, including Strict Mode replay. This is optional business-state integration, not a required step for normal actions.

Errors reject imperative execution; controls use their onError prop or the provider's onError. Defaults log to the console; applications can supply a toast or error display. Disabled, hidden, pending and missing actions are skipped. UI state is not server authorization.

Settings use the independent Settings catalog. Action groups describe presentation locations, while application components choose their layout. The existing plain-definition register/update interface remains available for integrations; the class API above is the primary entry point.

### Source map

- `action.ts`: inherited observable properties and behavior contract.
- `action-list.ts`: registration, updates and ownership.
- `execution.ts`: invocation guards and pending lifecycle.
- `types.ts`: shared contracts; `core.ts`: non-React exports.
- `base/`: reusable action specializations.
- `react/`: provider and shared hooks.
- `components/`: reusable UI bindings.
- `groups.ts` and `components/action-group-binding.tsx`: typed placement groups and reactive views.
- `interceptors.ts`: cancellable pre-execution checks and outcome subscriptions.
- `next.tsx`: optional Next.js adapter.

## Groups and contextual menus

```tsx
const memberMenu = new ActionGroup<MemberContext>('organization.member.menu');
class PromoteMember extends Action<MemberContext> {
  isVisible({ member }: MemberContext) { return member.role === 'member'; }
  isEnabled({ canManage }: MemberContext) { return canManage; }
  async execute({ member }: MemberContext) { await promote(member.id); }
}
const registration = actions.register(
  new PromoteMember({ id: 'member.promote', title: 'Promote to admin' }),
  { groups: [memberMenu], order: 10 },
);
// A renderer supplies a view, which receives live groups of BoundAction items.
<ActionGroupBinding groups={[memberMenu]} context={rowContext} as={MemberMenuView} />
// Within the view:
<ActionMenuItem binding={item} as={DropdownMenuItem} />
// Remove every placement owned by this contribution:
registration.unregister();
```

A contribution is registered once with all its groups. Group IDs are stable extension points, not namespaces for Action IDs. Hidden items and empty groups disappear. The view's group order is explicit; entries use `order` then their unique ID. Context is passed per rendering/invocation, never assigned to the shared action instance. Updating an Action updates all mounted views. Resolving a row never changes another row's enabled state.

## Interception and logging integrations

```ts
const stopCheck = actions.use({
  async before(context) {
    return await confirmIfNeeded(context);
  },
});
const stopObserving = actions.subscribeExecution((event) => {
  // started / completed / skipped / failed; do not log private input by default.
  recordOutcome({ action: event.id, phase: event.phase, time: event.timestamp });
});
// Retain cleanup handles for plugin-owned extensions.
stopCheck();
stopObserving();
```

A false interceptor result cancels execution. Guards and registration ownership are checked again after awaiting interceptors. Observer errors cannot turn a completed mutation into a failure. The stream is an application integration point, not a durable or trusted server audit trail. Audit identity and authorization must come from verified server sessions. Native navigation links retain browser behavior and do not execute a second command pipeline.

## Typed action IDs

`ActionMap` is an augmentable interface keyed by action ID with `{ input, result }` per entry. The Next discovery adapter generates it from discovered definitions; explicit hosts and packages augment it themselves:

```ts
declare module '@bitakit/core' {
  interface ActionMap {
    'members.promote': { input: MemberContext; result: void };
  }
}
useAction('members.promote')?.execute({ memberId }); // input and result are typed
list.execute('members.promote', { memberId }); // same for imperative execution
```

`useAction`, `list.execute`, `ActionButton`, `ActionBinding` and the other bindings accept known IDs with autocompletion. Unknown strings stay allowed and untyped, so page-owned or dynamic registrations keep working. Augment `ActionMapOptions` with `{ strict: true }` to reject unknown IDs at compile time. Types never replace runtime validation of input that arrives from JavaScript or the network.

Registrations marked `internal: true` remain executable and subscribable by ID but are hidden from `useActions()` and group views. Form actions use this for their `<id>.submit` registration; pass `useActions({ internal: true })` to enumerate everything.
