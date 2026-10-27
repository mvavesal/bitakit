import { defineSettings, setting, type ServiceContext, type SettingsOf } from '../src/core.js';

// One declaration per plugin; the generated map derives from it.
const todos = defineSettings({
  pageSize: setting({ default: 20 }),
  theme: setting({
    default: 'system',
    options: [{ value: 'light' }, { value: 'dark' }, { value: 'system' }],
  }),
  limit: setting({ schema: { parse: (value: unknown) => Number(value) }, default: 1 }),
  compact: setting({ default: false, scope: 'device' }),
});
type TodoSettings = SettingsOf<typeof todos, 'todos'>;
const declared: TodoSettings = {
  'todos.pageSize': 1,
  'todos.theme': 'dark',
  'todos.limit': 2,
  'todos.compact': true,
};
// @ts-expect-error Option values form the type.
const wrongOption: TodoSettings = { ...declared, 'todos.theme': 'blue' };
// App settings keep their plain names.
const appSettings: SettingsOf<typeof todos, ''> = {
  pageSize: 1,
  theme: 'light',
  limit: 1,
  compact: false,
};
// Several of the options: a list of the option union.
const channels = setting({
  default: ['email'],
  options: [{ value: 'email' }, { value: 'sms' }],
});
const chosen: ('email' | 'sms')[] = channels.default;
// @ts-expect-error Each chosen value is one of the options.
setting({ default: ['fax'], options: [{ value: 'email' }, { value: 'sms' }] });
// A list of texts follows its default.
const tags: string[] = setting({ default: ['a'], control: 'list' }).default;
// @ts-expect-error The default must match the schema output.
setting({ schema: { parse: (value: unknown) => Number(value) }, default: 'one' });
declare module '../src/core.js' {
  interface SettingsMap extends SettingsOf<typeof todos, 'todos'> {}
}
declare const context: ServiceContext;
const size: number = context.settings.todos.pageSize.get();
const saved: Promise<'saved' | 'superseded' | 'cancelled'> =
  context.settings.todos.theme.set('dark');
// @ts-expect-error Writes are typed.
context.settings.todos.theme.set('blue');
// @ts-expect-error Unknown settings are not part of completion.
context.settings.todos.unknown;
void [declared, wrongOption, appSettings, size, saved];
