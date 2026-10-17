/** Compile-time contract of the React bindings; checked by `tsc -p tsconfig.test.json`, never executed. */
import type { ReactNode } from 'react';
import {
  defineAction,
  defineService,
  definePlugin,
  defineEvents,
  event,
  type ActionEntry,
  type EventsOf,
  type FoundationApp,
  type PublicServicesOf,
  type Services,
  type Store,
} from '@bitakit/core';
import type { ActionId, ActionInput, ActionResult, ExecutionResult } from '@bitakit/core/actions';
import {
  useAction,
  useActionGroup,
  useActionGroups,
  type ActionControl,
  type BoundGroup,
  type ControlAdapters,
  type ControlProps,
} from '../src/actions/index.js';
import { useEvent, useFoundationApp, useService, useServiceState } from '../src/index.js';
import type { ActionButtonProps } from '../src/components/action-button.js';
import type { ActionProps } from '../src/components/action.js';
import type { FoundationProviderProps } from '../src/types/provider.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// --- defineAction: input and result inference -------------------------------------------------

const memberSchema = { parse: (input: unknown) => ({ memberId: String(input) }) };
const promote = defineAction({
  input: memberSchema,
  // Presentation runs without input for menus and search, so input may be undefined.
  visible: ({ input }) => (input?.memberId.length ?? 0) > 0,
  confirm: ({ input }) => `Promote ${input?.memberId ?? 'this member'}?`,
  execute: async ({ input }) => ({ id: input.memberId }),
});
type _Promote = Assert<
  Equal<
    ActionEntry<typeof promote, 'members.promote'>,
    { 'members.promote': { input: { memberId: string }; result: { id: string } } }
  >
>;

// Without a schema the input is named explicitly; the result is then unknown.
const add = defineAction<string>({
  enabled: ({ input }) => (input?.trim().length ?? 0) > 0,
  execute: ({ input }) => input.length,
});
defineAction<string>({
  // @ts-expect-error Presentation input may be undefined; guard it.
  title: ({ input }) => input.trim(),
  execute: () => undefined,
});
type AddEntry = ActionEntry<typeof add, 'todos.add'>;
type _AddKey = Assert<Equal<keyof AddEntry, 'todos.add'>>;
type _AddInput = Assert<Equal<AddEntry['todos.add']['input'], string>>;
type _AddResult = Assert<Equal<AddEntry['todos.add']['result'], unknown>>;

const help = defineAction({ title: 'Help', href: '/help', groups: ['navigation'] });
type HelpEntry = ActionEntry<typeof help, 'account.help'>;
type _HelpKey = Assert<Equal<keyof HelpEntry, 'account.help'>>;
type _HelpInput = Assert<Equal<HelpEntry['account.help']['input'], unknown>>;
type _HelpResult = Assert<Equal<HelpEntry['account.help']['result'], unknown>>;

// Dialog and page components may type the props the host passes them.
function RenameDialog({
  input,
  close,
}: {
  input: { id: number };
  close(): void;
  services: Services;
}) {
  void input.id;
  void close;
  return null;
}
const rename = defineAction({ title: 'Rename', dialog: RenameDialog, dialogSize: 'wide' });
function Details({ params }: { params: { id: string } }) {
  void params.id;
  return null;
}
const tasks = definePlugin({
  id: 'tasks',
  ui: { pages: [{ path: '/tasks/[id]', component: Details }] },
});
void rename;
void tasks;

// Shortcut inputs follow the action contract; contextual input is never guessed from UI focus.
defineAction<{ documentId: string }>({
  shortcut: { keys: 'Mod+Shift+S', input: { documentId: 'current' } },
  execute: ({ input }) => {
    void input.documentId;
  },
});
defineAction<{ documentId: string }>({
  // @ts-expect-error Actions requiring input must declare their keyboard input.
  shortcut: { keys: 'Mod+Shift+S' },
});
defineAction<void>({ shortcut: { keys: 'Mod+Shift+S' }, execute() {} });

// --- Plugins, services and events -------------------------------------------------------------

const items = defineService(({ store }) => {
  const state = store({ items: [] as string[] });
  return {
    state,
    add: (title: string) => state.set((current) => ({ items: [...current.items, title] })),
  };
});
const todosEvents = defineEvents({
  changed: event<{ kind: 'added' | 'removed' }>(),
  deleting: event<{ id: number }>({ cancelable: true }),
});
const todos = definePlugin({ id: 'todos', services: { items }, events: todosEvents });
type TodoServices = PublicServicesOf<readonly [typeof todos]>;
type _ServiceNames = Assert<Equal<keyof TodoServices, 'todos.items'>>;
// Manual compositions type the app facade through the hook generic.
declare const composed: ReturnType<typeof useFoundationApp<readonly [typeof todos]>>;
const composedState: Store<{ items: string[] }> = composed.services.todos.items.state;
// @ts-expect-error Unpublished services are absent from completion.
composed.services.notes;
void composedState;

// The same augmentations build tooling generates into src/bitakit.gen.tsx. The service entry is
// written by hand here, as the generated file derives it from each service file.
declare module '@bitakit/core' {
  interface ActionMap
    extends ActionEntry<typeof promote, 'members.promote'>,
      ActionEntry<typeof add, 'todos.add'> {}
  interface ServiceMap {
    'todos.items': { state: Store<{ items: string[] }>; add(title: string): void };
  }
  interface EventMap extends EventsOf<typeof todosEvents, 'todos'> {}
}
type _Input = Assert<Equal<ActionInput<'members.promote'>, { memberId: string }>>;
type _Result = Assert<Equal<ActionResult<'members.promote'>, { id: string }>>;
type _UnknownInput = Assert<Equal<ActionInput<'not.registered'>, unknown>>;

// --- useAction: one control with state and prop getters ----------------------------------------

declare const control: ReturnType<typeof useAction<'members.promote'>>;
type _Control = Assert<Equal<typeof control, ActionControl<'members.promote'> | undefined>>;
const outcome: Promise<ExecutionResult<{ id: string }>> | undefined = control?.execute({
  memberId: 'a',
});
// @ts-expect-error Input follows the action map.
void control?.execute({ memberId: 1 });
if (control) {
  const state: [boolean, boolean, boolean, boolean, string, string | undefined] = [
    control.enabled,
    control.visible,
    control.pending,
    control.disabled,
    control.title,
    control.href,
  ];
  const button: ControlProps = control.props({
    onExecuted: (result) => {
      const status: 'completed' | 'skipped' = result.status;
      void status;
    },
    onError: (error: unknown) => void error,
  });
  const link: ControlProps = control.linkProps();
  const toggle: ControlProps = control.checkedProps();
  const choice: ControlProps = control.valueProps();
  const item: ControlProps = control.menuItemProps();
  // @ts-expect-error Controls carry no action-owned custom state.
  control.state;
  // @ts-expect-error Status spelling mistakes are rejected.
  control.status === 'suceeded';
  void state;
  void button;
  void link;
  void toggle;
  void choice;
  void item;
}
// Non-strict default: unknown IDs stay allowed and untyped.
const dynamic: ActionId = 'not.registered';
declare const untyped: ReturnType<typeof useAction<'not.registered'>>;
void untyped?.execute('anything');
export { outcome, dynamic };

// --- References from the app facade -----------------------------------------------------------

declare const app: FoundationApp;
const referenced: Promise<ExecutionResult<{ id: string }>> = app.actions.members.promote.execute({
  memberId: 'a',
});
// @ts-expect-error References preserve the input contract.
app.actions.members.promote.execute({ memberId: 1 });
// @ts-expect-error Namespace completion excludes unknown actions.
app.actions.members.unknown;
const added: string[] = app.services.todos.items.state.get().items;
void referenced;
void added;

// --- Components ------------------------------------------------------------------------------

function CustomButton(props: { tone: 'primary' | 'secondary'; children?: ReactNode }) {
  void props;
  return null;
}
const buttonProps: ActionButtonProps<'members.promote'> = {
  action: app.actions.members.promote,
  input: { memberId: 'a' },
};
const customButton: ActionButtonProps<'todos.add', typeof CustomButton> = {
  action: 'todos.add',
  input: 'Milk',
  as: CustomButton,
  tone: 'primary',
};
const wrongTone: ActionButtonProps<'todos.add', typeof CustomButton> = {
  action: 'todos.add',
  as: CustomButton,
  // @ts-expect-error Component props follow `as`.
  tone: 'loud',
};
// @ts-expect-error Input follows the action map.
const wrongInput: ActionButtonProps<'todos.add'> = { action: 'todos.add', input: 42 };
const actionProps: ActionProps<'members.promote'> = {
  id: 'members.promote',
  input: { memberId: 'a' },
  children: (bound) => bound.title,
};
const wrongActionProps: ActionProps<'members.promote'> = {
  id: 'members.promote',
  // @ts-expect-error Input follows the action map.
  input: { memberId: 1 },
  children: () => null,
};
void buttonProps;
void customButton;
void wrongTone;
void wrongInput;
void actionProps;
void wrongActionProps;

// --- Hooks ------------------------------------------------------------------------------------

export function Consumer() {
  const titles = useServiceState('todos.items', (state) => state.items);
  type _Titles = Assert<Equal<typeof titles, string[] | undefined>>;
  const safe = useServiceState('todos.items', (state) => state.items, []);
  type _Safe = Assert<Equal<typeof safe, string[]>>;
  const whole = useServiceState('todos.items');
  type _Whole = Assert<Equal<typeof whole, { items: string[] } | undefined>>;
  // @ts-expect-error Selectors see the typed store state.
  useServiceState('todos.items', (state) => state.missing);
  const unknown = useServiceState('other.service');
  type _Unknown = Assert<Equal<typeof unknown, unknown>>;
  const service = useService('todos.items');
  type _Service = Assert<Equal<NonNullable<typeof service>['add'], (title: string) => void>>;
  useEvent('todos.changed', (changed) => {
    const kind: 'added' | 'removed' = changed.data.kind;
    void kind;
  });
  useEvent('todos.*', (any) => {
    const type: 'todos.changed' | 'todos.deleting' = any.type;
    void type;
  });
  useEvent(['todos.changed'], () => {});
  useEvent('todos.changed', (changed) => {
    // @ts-expect-error Payloads follow the event map.
    const wrong: number = changed.data.kind;
    void wrong;
  });
  const group: BoundGroup = useActionGroup('navigation');
  const groups: readonly BoundGroup[] = useActionGroups(['navigation', 'todos.toolbar'], { id: 1 });
  type _Items = Assert<Equal<BoundGroup['items'], readonly ActionControl[]>>;
  void titles;
  void safe;
  void whole;
  void unknown;
  void group;
  void groups;
  return null;
}

// --- Provider ---------------------------------------------------------------------------------

const controls: ControlAdapters = {
  button: (state) => ({ isDisabled: state.disabled }),
  link: (state) => ({ isDisabled: !state.href }),
};
// @ts-expect-error Only the five control kinds have adapters.
const unknownControl: ControlAdapters = { switch: () => ({}) };
const providerProps: FoundationProviderProps = {
  config: {},
  controls,
  additionalPlugins: [todos, tasks],
  labels: { confirm: 'Yes' },
  notify: (message, kind) => {
    const known: 'success' | 'failure' = kind;
    void known;
    void message;
  },
  children: null,
};
void controls;
void unknownControl;
void providerProps;

// Slot payloads belong to outlets; mapped Action inputs retain the existing Action contract.
import { defineSlot } from '@bitakit/core';
import { useSlot, PluginSlot, type SlotProps } from '../src/index.js';
const memberMenu = defineSlot({
  accepts: 'actions',
  payload: { parse: () => ({ memberId: 'ada' }) },
});
const footerSlot = defineSlot({
  accepts: 'component',
  payload: { parse: () => ({ collapsed: false }) },
});
declare module '@bitakit/core' {
  interface SlotMap {
    'members.menu': typeof memberMenu;
    'shell.footer': typeof footerSlot;
  }
}
defineAction<string>({
  slots: [{ slot: 'members.menu', input: ({ payload }) => payload.memberId }],
  execute: () => {},
});
// @ts-expect-error Components cannot accept an Action placement.
defineAction({ slots: ['shell.footer'] });
// @ts-expect-error Unknown placement names do not pass a generated map.
defineAction({ slots: ['misspelled.menu'] });
defineAction<string>({
  // @ts-expect-error The input mapper must return the Action's input type.
  slots: [{ slot: 'members.menu', input: ({ payload }) => payload }],
});
function slotTypes() {
  const menu = useSlot('members.menu', { payload: { memberId: 'ada' } });
  menu.items[0]?.action.execute();
  // @ts-expect-error Action slots have no component entry.
  menu.items[0]?.component;
  // @ts-expect-error An owner payload is required.
  useSlot('members.menu');
  // @ts-expect-error Payload fields are schema-typed.
  useSlot('members.menu', { payload: { memberId: 1 } });
  const props: SlotProps<'shell.footer'> = { payload: { collapsed: true } };
  PluginSlot({ name: 'shell.footer', ...props });
  // @ts-expect-error Component outlets must supply the defined payload.
  PluginSlot({ name: 'shell.footer' });
}
void slotTypes;

// @ts-expect-error PluginSlot is the component renderer; Action owners use useSlot.
PluginSlot({ name: 'members.menu', payload: { memberId: 'ada' } });
const keyedMenu = defineSlot({ accepts: 'actions', policy: 'keyed' });
declare module '@bitakit/core' {
  interface SlotMap {
    'keyed.menu': typeof keyedMenu;
  }
}
// @ts-expect-error Keyed placements require an explicit key, so string shorthand is insufficient.
defineAction({ slots: ['keyed.menu'] });
// @ts-expect-error Keyed placements require an explicit key.
defineAction({ slots: [{ slot: 'keyed.menu' }] });
defineAction({ slots: [{ slot: 'keyed.menu', key: 'primary' }] });
