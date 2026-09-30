'use client';
import { useState, useSyncExternalStore, useId, useRef, useEffect, type FormEvent } from 'react';
import { useAction, useActions } from '@bitakit/ui/actions';
import type { ResolvedForm } from '@bitakit/core';
import { ActionFailure } from '@bitakit/core';
import { useTranslation } from '../hooks/use-translation.js';
import { useFoundation } from '../providers/foundation-context.js';
import { validateFields } from '@bitakit/core';
import { useDialogFocus } from '../hooks/use-dialog-focus.js';

export function DialogHost() {
  const { runtime, ui } = useFoundation();
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getServerSnapshot,
  );
  const restoreFocus = useDialogFocus(runtime);
  const snapshots = useActions();
  const current = useAction(state?.definition.id ?? '', state?.input);
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
      {definition.kind === 'form' ? (
        <FormDialog key={definition.id} definition={definition} restoreFocus={restoreFocus} />
      ) : (
        <ui.DialogContent
          size={definition.size}
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
            ? definition.render({
                input: state.input,
                close: runtime.close,
                services: runtime.services,
              })
            : null}
        </ui.DialogContent>
      )}
    </ui.Dialog>
  );
}
function FormDialog({
  definition,
  restoreFocus,
}: {
  definition: ResolvedForm;
  restoreFocus(event: { preventDefault(): void }): void;
}) {
  const { runtime, ui, labels: defaults } = useFoundation();
  const t = useTranslation();
  const labels = Object.fromEntries(Object.entries(defaults).map(([key, text]) => [key, t(`Foundation.${key}`, undefined, text)])) as typeof defaults;
  const id = useId();
  const token = runtime.getSnapshot()?.token;
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(definition.fields).map(([key, field]) => [key, field.defaultValue ?? '']),
    ),
  );
  const [error, setError] = useState<{ invalid: true } | { message: string | false } | null>(null);
  const action = useAction(`${definition.id}.submit`);
  const opener = useAction(definition.id, runtime.getSnapshot()?.input);
  const pending = action?.pending ?? false;
  const enabled = !!action?.enabled && !!opener?.enabled;
  const errorText =
    error && 'invalid' in error
      ? labels.invalid
      : error && 'message' in error
        ? error.message || null
        : null;
  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || !enabled || pending) return;
    setError(null);
    try {
      validateFields(definition.fields, values);
    } catch {
      setError({ invalid: true });
      return;
    }
    try {
      await runtime.submitForm(definition, values);
    } catch (error) {
      if (live.current && runtime.getSnapshot()?.token === token)
        setError({
          message:
            error instanceof ActionFailure
              ? error.feedback
              : runtime.text('Foundation.failure', 'Action failed. Please try again.'),
        });
    }
  }
  return (
    <ui.DialogContent
      onCloseAutoFocus={restoreFocus}
      aria-describedby={opener?.description ? `${id}-description` : undefined}
      onEscapeKeyDown={(event: { preventDefault(): void }) => {
        if (pending) event.preventDefault();
      }}
      onPointerDownOutside={(event: { preventDefault(): void }) => {
        if (pending) event.preventDefault();
      }}
    >
      <ui.DialogHeader>
        <ui.DialogTitle>{opener?.title}</ui.DialogTitle>
        {opener?.description && (
          <ui.DialogDescription id={`${id}-description`}>{opener.description}</ui.DialogDescription>
        )}
      </ui.DialogHeader>
      {definition.render ? (
        definition.render({
          values,
          setValue,
          submit,
          pending,
          enabled,
          error: errorText,
        })
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-6" aria-busy={pending}>
          <ui.FieldGroup>
            {Object.entries(definition.fields).map(([name, field]) => (
              <ui.Field
                key={name}
                data-disabled={pending || undefined}
                data-invalid={(error && 'invalid' in error) || undefined}
              >
                <ui.FieldLabel htmlFor={`${id}-${name}`}>
                  {runtime.fieldLabel(definition, name, field)}
                </ui.FieldLabel>
                {field.type === 'select' ? (
                  <select
                    id={`${id}-${name}`}
                    value={values[name]}
                    required={field.required}
                    disabled={pending}
                    className="h-9 rounded-md border bg-background px-3"
                    onChange={(event) => setValue(name, event.target.value)}
                  >
                    <option value="" disabled>
                      {runtime.fieldLabel(definition, name, field)}
                    </option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {runtime.text(option.label, option.label)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ui.Input
                    id={`${id}-${name}`}
                    type={field.type}
                    value={values[name]}
                    required={field.required}
                    disabled={pending}
                    aria-invalid={(error && 'invalid' in error) || undefined}
                    onChange={(event: { target: { value: string } }) =>
                      setValue(name, event.target.value)
                    }
                  />
                )}
              </ui.Field>
            ))}
          </ui.FieldGroup>
          {errorText && <ui.FieldError>{errorText}</ui.FieldError>}
          <ui.DialogFooter>
            <ui.Button type="button" variant="outline" disabled={pending} onClick={runtime.close}>
              {labels.cancel}
            </ui.Button>
            <ui.Button type="submit" disabled={!enabled || pending}>
              {pending ? labels.pending : (opener?.title ?? labels.submit)}
            </ui.Button>
          </ui.DialogFooter>
        </form>
      )}
    </ui.DialogContent>
  );
}
