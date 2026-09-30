import {
  Action,
  defineAction,
  defineDialogAction,
  defineFormAction,
  defineURLAction,
  type ActionEntry,
  type ActionEnvironment,
} from '@bitakit/core';
import type {
  ActionId,
  ActionInput,
  ActionResult,
  ExecutionResult,
} from '@bitakit/core/actions';
import { useAction } from '../src/actions/index.js';

/** Compile-time contract only; never executed. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

const command = defineAction({
  resolve: (input: { memberId: string }) => ({ visible: !!input.memberId }),
  execute: async () => ({ id: 'created' }),
});
type _CommandEntry = Assert<
  Equal<
    ActionEntry<typeof command, 'members.promote'>,
    { 'members.promote': { input: { memberId: string }; result: { id: string } } }
  >
>;

const explicit = defineAction({ id: 'custom.id', title: 'Custom' });
type _ExplicitId = Assert<Equal<keyof ActionEntry<typeof explicit, 'ignored.path'>, 'custom.id'>>;

const replacement = defineAction({ replaces: 'plugin.example' });
type _Replacement = Assert<
  Equal<keyof ActionEntry<typeof replacement, 'app.override'>, 'plugin.example'>
>;

const form = defineFormAction({ fields: { email: { type: 'email' } }, submit: () => 1 });
type _Form = Assert<
  Equal<
    ActionEntry<typeof form, 'users.invite'>,
    { 'users.invite': { input: unknown; result: void } }
  >
>;

const dialog = defineDialogAction({
  resolve: (input: { organizationId: string }) => ({ enabled: !!input.organizationId }),
  render: () => null,
});
type _Dialog = Assert<
  Equal<
    ActionEntry<typeof dialog, 'organizations.edit'>,
    { 'organizations.edit': { input: { organizationId: string }; result: void } }
  >
>;

const url = defineURLAction({ href: '/help' });
type _Url = Assert<
  Equal<ActionEntry<typeof url, 'account.help'>, { 'account.help': { input: void; result: void } }>
>;

// Class and function exports choose their ID at construction, so discovery emits no entry for them.
class Logout extends Action {
  constructor() {
    super({ id: 'account.signOut', title: 'Sign out' });
  }
}
type _Class = Assert<Equal<ActionEntry<typeof Logout, 'account.logout'>, {}>>;
const factory = (_: ActionEnvironment) => new Logout();
type _Factory = Assert<Equal<ActionEntry<typeof factory, 'account.logout'>, {}>>;

// Global conventions disabled: only explicit IDs remain.
type _NoConventions = Assert<Equal<ActionEntry<typeof command, never>, {}>>;
type _NoConventionsExplicit = Assert<Equal<keyof ActionEntry<typeof explicit, never>, 'custom.id'>>;

import { ActionStatus } from '@bitakit/core';
const stateful = defineAction<{ title: string }>()({
  initialState: { count: 0, title: '' },
  async execute(input) {
    this.state.update((current) => ({ count: current.count + 1, title: input.title }));
    // @ts-expect-error Custom state retains its inferred field types.
    this.state.update((current) => ({ count: 'bad', title: current.title }));
    return { savedTitle: input.title };
  },
});
declare module '@bitakit/core' {
  interface ActionMap extends ActionEntry<typeof stateful, 'documents.save'> {}
}

// The same augmentation build tooling generates, through the public package entry.
declare module '@bitakit/core' {
  interface ActionMap extends ActionEntry<typeof command, 'members.promote'> {}
}
type _Input = Assert<Equal<ActionInput<'members.promote'>, { memberId: string }>>;
type _Result = Assert<Equal<ActionResult<'members.promote'>, { id: string }>>;
type _UnknownInput = Assert<Equal<ActionInput<'not.registered'>, unknown>>;

declare const promote: ReturnType<typeof useAction<'members.promote'>>;
const outcome: Promise<ExecutionResult<{ id: string }>> | undefined = promote?.execute({
  memberId: 'a',
});
// @ts-expect-error Input follows the action map.
void promote?.execute({ memberId: 1 });
// Non-strict default: unknown IDs stay allowed and untyped.
const dynamic: ActionId = 'not.registered';
declare const untyped: ReturnType<typeof useAction<'not.registered'>>;
void untyped?.execute('anything');
export { outcome, dynamic };

import type { FoundationApp } from '@bitakit/core';
import type { ActionButtonProps } from '../src/components/action-button.js';
declare const app: FoundationApp;
const referencedOutcome: Promise<ExecutionResult<{ id: string }>> =
  app.actions.members.promote.execute({ memberId: 'a' });
const buttonProps: ActionButtonProps<'members.promote'> = {
  action: app.actions.members.promote,
  input: { memberId: 'a' },
};
// @ts-expect-error References preserve the existing Action input contract.
app.actions.members.promote.execute({ memberId: 1 });
// @ts-expect-error Namespace completion excludes unknown Actions.
app.actions.members.unknown;
void referencedOutcome;
void buttonProps;

const statefulBinding = useAction(app.actions.documents.save);
if (statefulBinding) {
  const count: number = statefulBinding.state.count;
  const result: Promise<ExecutionResult<{ savedTitle: string }>> = statefulBinding.execute({
    title: 'Title',
  });
  // @ts-expect-error State is read-only outside the action update API.
  statefulBinding.state.count = 4;
  // @ts-expect-error Unknown state field.
  statefulBinding.state.missing;
  // @ts-expect-error Status spelling mistakes are rejected.
  statefulBinding.status === 'suceeded';
  // @ts-expect-error Enum member spelling mistakes are rejected.
  ActionStatus.Suceeded;
  // @ts-expect-error Wrong invocation input.
  statefulBinding.execute({ title: 4 });
  void count;
  void result;
}

// Shortcut inputs follow the Action contract; contextual input is never guessed from UI focus.
defineAction<{ documentId: string }, void>({
  shortcut: { keys: 'Mod+Shift+S', input: { documentId: 'current' } },
  execute: ({ input }) => {
    void input.documentId;
  },
});
defineAction<{ documentId: string }, void>({
  // @ts-expect-error Actions requiring input must declare their keyboard input.
  shortcut: { keys: 'Mod+Shift+S' },
});
defineAction<void, void>({ shortcut: { keys: 'Mod+Shift+S' }, execute() {} });
defineAction<{ documentId: string }>()({
  initialState: {},
  // @ts-expect-error Stateful Actions keep the same required input contract.
  shortcut: { keys: 'Mod+Shift+S' },
  execute() {},
});
