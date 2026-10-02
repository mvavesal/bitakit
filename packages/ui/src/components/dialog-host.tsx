'use client';
import { createElement, useSyncExternalStore } from 'react';
import { useAction, useActions } from '../hooks/use-action.js';
import { useFoundation } from '../providers/foundation-context.js';
import { useDialogFocus } from '../hooks/use-dialog-focus.js';

/** Renders the dialog of the action that opened one; the host supplies the dialog primitives. */
export function DialogHost() {
  const { runtime, ui } = useFoundation();
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getServerSnapshot,
  );
  const restoreFocus = useDialogFocus(runtime);
  const snapshots = useActions();
  const current = useAction((state?.definition.id ?? '') as never, state?.input as never);
  if (!state) return null;
  const action = current ?? snapshots[state.definition.id];
  if (!action?.visible) return null;
  const definition = state.definition;
  return (
    <ui.Dialog
      open
      onOpenChange={(open) => {
        if (!open) runtime.close();
      }}
    >
      <ui.DialogContent
        size={definition.dialogSize}
        aria-describedby={action.description ? `${definition.id}-description` : undefined}
        onCloseAutoFocus={restoreFocus}
      >
        <ui.DialogHeader>
          <ui.DialogTitle>{action.title}</ui.DialogTitle>
          {action.description && (
            <ui.DialogDescription id={`${definition.id}-description`}>
              {action.description}
            </ui.DialogDescription>
          )}
        </ui.DialogHeader>
        {action.enabled
          ? createElement(definition.dialog as never, {
              input: state.input,
              close: runtime.close,
              services: runtime.services,
              key: String(state.token.description ?? ''),
            })
          : null}
      </ui.DialogContent>
    </ui.Dialog>
  );
}
