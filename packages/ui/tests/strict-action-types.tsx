/** Checked independently: every known Action returns void, while slot controls stay dynamic. */
import {
  Action,
  ActionButton,
  ActionLink,
  useAction,
  useActionGroup,
  useSlot,
} from '../dist/index.js';
import type { ActionReference, ExecutionResult } from '@bitakit/core';

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
