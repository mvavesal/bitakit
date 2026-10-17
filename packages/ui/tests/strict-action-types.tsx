/** Checked independently: every known Action returns void, while slot controls stay dynamic. */
import {
  Action,
  ActionButton,
  ActionLink,
  PluginSlot,
  useAction,
  useActionGroup,
  useEvent,
  useServiceState,
  useSetting,
  useSlot,
} from '../dist/index.js';
import type { ActionReference, ExecutionResult, Store } from '@bitakit/core';

declare const reference: ActionReference<'counter.increment'>;

declare module '@bitakit/core' {
  interface ActionMapOptions {
    strict: true;
  }
  interface ActionMap {
    'counter.increment': { input: void; result: void };
  }
  interface SlotMap {
    'counter.toolbar': { accepts: 'actions' };
    'counter.sidebar': { accepts: 'component' };
  }
  interface EventMap {
    'counter.incremented': number;
  }
  interface SettingsMap {
    'counter.step': number;
  }
  interface ServiceMap {
    'counter.value': { state: Store<{ count: number }> };
  }
}

function bindings() {
  const toolbar = useSlot('counter.toolbar');
  for (const item of toolbar.items) {
    <Action id={item.action}>
      <button />
    </Action>;
    <ActionButton action={item.action} />;
    <ActionLink action={item.action} />;
    useAction(item.action);
  }
  for (const action of useActionGroup('counter.tools').items) {
    <Action id={action}>
      <button />
    </Action>;
  }
  <Action id="counter.increment">
    <button />
  </Action>;
  useAction('counter.increment');
  const result: Promise<ExecutionResult<void>> | undefined = useAction(reference)?.execute();
  void result;
  <Action id={reference}>
    <button />
  </Action>;
  // @ts-expect-error A known reference must retain its input contract as well.
  useAction(reference, 'wrong');
  // @ts-expect-error A dynamic control must not relax literal ID checking.
  <Action id="counter.typo">
    <button />
  </Action>;
  // @ts-expect-error Unknown literal IDs remain rejected by the hook.
  useAction('counter.typo');
  // @ts-expect-error Known Action inputs retain their type.
  <Action id="counter.increment" input="wrong">
    <button />
  </Action>;
  // @ts-expect-error Known hook inputs retain their type.
  useAction('counter.increment', 'wrong');
  // @ts-expect-error Sugar bindings also reject unknown literal IDs.
  <ActionButton action="counter.typo" />;
  // @ts-expect-error Link bindings also reject unknown literal IDs.
  <ActionLink action="counter.typo" />;
}
void bindings;

/** The same strict switch covers event, setting, service and slot names. */
function names() {
  useEvent('counter.incremented', (event) => {
    const count: number = event.data;
    void count;
  });
  useEvent('counter.*', () => {});
  useEvent('runtime.lifecycle', () => {});
  useEvent('*', () => {});
  // @ts-expect-error Strict apps reject unknown event names.
  useEvent('counter.incremnted', () => {});
  // @ts-expect-error Patterns must match declared events.
  useEvent('counters.*', () => {});
  const step: number | undefined = useSetting('counter.step').value;
  void step;
  // @ts-expect-error Strict apps reject unknown setting keys.
  useSetting('counter.stp');
  const count: number = useServiceState('counter.value', (state) => state.count, 0);
  void count;
  // @ts-expect-error Strict apps reject unknown service names.
  useServiceState('counter.valu');
  <PluginSlot name="counter.sidebar" />;
  // @ts-expect-error Strict apps reject unknown slot names.
  <PluginSlot name="counter.sidbar" />;
}
void names;
