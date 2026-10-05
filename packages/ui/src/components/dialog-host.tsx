'use client';
import { createElement, useSyncExternalStore } from 'react';
import { dialogOf } from '@bitakit/core';
import { useAction, useActions } from '../hooks/use-action.js';
import { useFoundation } from '../providers/foundation-context.js';
import { useDialogFocus } from '../hooks/use-dialog-focus.js';
import type { DialogFrameProps } from '../types/ui.js';

/** Frame kinds rendered with the host dialog primitives when no frame of that kind is registered. */
const builtInKinds = new Set(['dialog', 'command']);

/**
 * Renders the dialog of the action that opened one. The action names a frame kind; the host
 * supplies frames through `dialogs`, and the built-in kinds use the host dialog primitives:
 * `dialog` with a visible header, `command` as shadcn's CommandDialog, whose content (a search
 * field and results) is its own header.
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
  const Frame = dialogs?.[kind] ?? (builtInKinds.has(kind) ? undefined : dialogs?.dialog);
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
  if (!builtInKinds.has(kind))
    console.warn(
      `[bitakit] Action "${definition.id}" opens a "${kind}" dialog, but no frame of that kind is registered on FoundationProvider; the default dialog is used.`,
    );
  const command = kind === 'command';
  return (
    <ui.Dialog open onOpenChange={frame.onOpenChange}>
      <ui.DialogContent
        size={dialog.size}
        aria-describedby={action.description ? `${definition.id}-description` : undefined}
        onCloseAutoFocus={restoreFocus}
        showCloseButton={!command}
        className={command ? 'top-1/3 translate-y-0 gap-0 overflow-hidden p-0' : undefined}
      >
        <ui.DialogHeader className={command ? 'sr-only' : undefined}>
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
