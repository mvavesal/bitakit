'use client';
import { createElement, useSyncExternalStore } from 'react';
import { dialogOf } from '@bitakit/core';
import { useAction, useActions } from '../hooks/use-action.js';
import { useFoundation } from '../providers/foundation-context.js';
import { useDialogFocus } from '../hooks/use-dialog-focus.js';
import type { DialogFrameProps } from '../types/ui.js';

/**
 * Renders the dialog of the action that opened one. The action names a frame kind; the host
 * supplies frames through `dialogs`, and the default kind uses the host dialog primitives.
 */
export function DialogHost() {
  const { runtime, ui, dialogs } = useFoundation();
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
  const dialog = dialogOf(definition)!;
  const kind = dialog.kind ?? 'dialog';
  const Frame = dialogs?.[kind] ?? (kind === 'dialog' ? undefined : dialogs?.dialog);
  const content = action.enabled
    ? createElement(dialog.component as never, {
        input: state.input,
        close: runtime.close,
        services: runtime.services,
        key: String(state.token.description ?? ''),
      })
    : null;
  const frame: DialogFrameProps = {
    open: true,
    onOpenChange: (open) => {
      if (!open) runtime.close();
    },
    kind,
    size: dialog.size,
    title: action.title,
    description: action.description,
    actionId: definition.id,
    onCloseAutoFocus: restoreFocus,
    children: content,
  };
  if (Frame) return createElement(Frame, frame);
  if (kind !== 'dialog')
    console.warn(
      `[bitakit] Action "${definition.id}" opens a "${kind}" dialog, but no frame of that kind is registered on FoundationProvider; the default dialog is used.`,
    );
  return (
    <ui.Dialog open onOpenChange={frame.onOpenChange}>
      <ui.DialogContent
        size={dialog.size}
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
        {content}
      </ui.DialogContent>
    </ui.Dialog>
  );
}
