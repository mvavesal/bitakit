'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  useBitaKit,
  useSetting,
  useSettingsCatalog,
  useTranslation,
  type SettingsCatalogField,
} from '@bitakit/ui';
import {
  Button,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@bitakit/ui/components';
import AlertCircleIcon from 'reicon-react/icons/AlertCircle';
import LockIcon from 'reicon-react/icons/Lock';
import Undo3Icon from 'reicon-react/icons/Undo3';
import { catalogField, catalogText } from '../catalog.js';
import { settingAnchor } from '../paths.js';
import { sameValue } from '../same.js';
import { controlFor, draftControls, groupControls, SwitchControl } from './controls.js';
import { Spinner } from './ui/spinner.js';
import { useMessages } from './use-messages.js';

export type SettingFieldProps =
  | { field: SettingsCatalogField; settingKey?: undefined }
  | {
      /** A setting by key, also one that is `hidden` from generated pages. */
      settingKey: string;
      field?: undefined;
    };

/** Validation libraries report issues; storage reports an error message. */
function errorText(error: unknown): string {
  const issues = (error as { issues?: unknown } | null)?.issues;
  if (Array.isArray(issues)) {
    const messages = issues
      .map((issue) => (issue as { message?: unknown } | null)?.message)
      .filter((message): message is string => typeof message === 'string' && !!message);
    if (messages.length) return messages.join('; ');
  }
  return error instanceof Error && error.message ? error.message : String(error);
}
function focusControl(id: string, options?: FocusOptions) {
  const element = document.getElementById(id);
  const target = element?.matches('button, input, select, textarea')
    ? element
    : element?.querySelector<HTMLElement>(
        '[role="radio"][aria-checked="true"], button, input, select, textarea',
      );
  target?.focus(options);
}

const HIGHLIGHT_MS = 2400;

/**
 * Brings the setting into view when the address names it (`#setting-<key>`, see `settingHref`),
 * on arrival and on a later hash change: scrolled to the middle, its control focused and the field
 * marked for a moment. Returns whether it is marked.
 */
function useLinkedSetting(anchor: string, controlId: string) {
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      let hash = window.location.hash.slice(1);
      try {
        hash = decodeURIComponent(hash);
      } catch {
        // A malformed hash names no setting.
      }
      if (hash !== anchor) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document
        .getElementById(anchor)
        ?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      focusControl(controlId, { preventScroll: true });
      setLinked(true);
      clearTimeout(timer);
      timer = setTimeout(() => setLinked(false), HIGHLIGHT_MS);
    };
    // After the page has laid out; a mount that is replaced right away (the provider starting up)
    // cancels it, so the field scrolls and focuses once.
    const arrival = setTimeout(reveal);
    window.addEventListener('hashchange', reveal);
    return () => {
      window.removeEventListener('hashchange', reveal);
      clearTimeout(arrival);
      clearTimeout(timer);
    };
  }, [anchor, controlId]);
  return linked;
}

/** The catalog field of a key; hidden settings get the same labels outside the catalog. */
function useField(props: SettingFieldProps): SettingsCatalogField {
  const catalog = useSettingsCatalog();
  const { runtime } = useBitaKit();
  const t = useTranslation();
  const { field, settingKey } = props;
  return useMemo(() => {
    if (field) return field;
    for (const section of catalog)
      for (const candidate of section.fields) if (candidate.key === settingKey) return candidate;
    // Throws Core's named error for an undeclared key.
    const entry = runtime.settings.definition(settingKey!);
    return catalogField(
      entry,
      entry.plugin === (runtime.config.appId ?? 'app'),
      catalogText(runtime.translator()),
    );
  }, [field, settingKey, catalog, runtime, t]);
}

/**
 * One setting with its label, description, control, saving state, inline error and a reset to
 * the default. Reads and writes through `useSetting`; a failed write keeps the confirmed value.
 */
export function SettingField(props: SettingFieldProps) {
  const field = useField(props);
  const setting = useSetting(field.key);
  const messages = useMessages();
  const id = useId();
  const ids = {
    control: `${id}control`,
    label: `${id}label`,
    description: `${id}description`,
    feedback: `${id}feedback`,
  };
  const Control = controlFor(field);
  const anchor = settingAnchor(field.key);
  const linked = useLinkedSetting(anchor, ids.control);
  // The value a running write is about to confirm; draft-based controls keep their own.
  const [draft, setDraft] = useState<{ value: unknown; token: number }>();
  const [rejected, setRejected] = useState<string>();
  const latest = useRef(0);
  const resetButton = useRef<HTMLButtonElement>(null);
  // A reload (identity change) replaces whatever the last write reported.
  useEffect(() => setRejected(undefined), [setting.ready]);

  const write = (run: () => Promise<unknown>, value: unknown, done?: () => void) => {
    const token = ++latest.current;
    setRejected(undefined);
    if (!Control || !draftControls.has(Control)) setDraft({ value, token });
    const settle = () => {
      if (token !== latest.current) return false;
      setDraft(undefined);
      return true;
    };
    run().then(
      () => {
        if (settle()) done?.();
      },
      (error: unknown) => {
        if (settle()) setRejected(errorText(error));
      },
    );
  };
  const reset = () => {
    const focused = document.activeElement === resetButton.current;
    write(
      () => setting.reset(),
      field.spec.default,
      () =>
        setTimeout(() => {
          // The button leaves once the value is the default; keep the keyboard position.
          if (focused && !resetButton.current) focusControl(ids.control);
        }),
    );
  };

  const disabled = !setting.ready || !setting.writable;
  const failure =
    rejected !== undefined
      ? messages('saveFailed', { error: rejected })
      : setting.error
        ? setting.ready
          ? setting.error
          : messages('loadFailed', { error: setting.error })
        : undefined;
  const readOnly = setting.ready && !setting.writable && !failure;
  const canReset =
    setting.ready && setting.writable && !sameValue(setting.value, field.spec.default);
  const grouped = !!Control && groupControls.has(Control);
  const horizontal = Control === SwitchControl;
  const describedBy = [field.description ? ids.description : undefined, ids.feedback]
    .filter(Boolean)
    .join(' ');

  const feedback = (
    <div id={ids.feedback} className="empty:hidden">
      {failure ? (
        <FieldError>
          <span className="flex items-start gap-2">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">{failure}</span>
          </span>
        </FieldError>
      ) : setting.pending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          {messages('saving')}
        </p>
      ) : readOnly ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockIcon className="size-4 shrink-0" aria-hidden="true" />
          {messages('readOnly')}
        </p>
      ) : null}
    </div>
  );
  return (
    <Field
      id={anchor}
      orientation={horizontal ? 'horizontal' : 'vertical'}
      data-setting={field.key}
      data-linked={linked || undefined}
      className="scroll-mt-24 rounded-lg transition-shadow duration-300 data-[linked=true]:ring-(length:--focus-ring-width) data-[linked=true]:ring-ring/50 data-[linked=true]:ring-offset-4 data-[linked=true]:ring-offset-background"
      data-invalid={!!failure || undefined}
      data-disabled={disabled || undefined}
      aria-labelledby={grouped ? ids.label : undefined}
      aria-busy={!setting.ready || undefined}
    >
      <FieldContent>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {grouped || !Control ? (
            <FieldTitle id={ids.label}>{field.label}</FieldTitle>
          ) : (
            <FieldLabel id={ids.label} htmlFor={ids.control}>
              {field.label}
            </FieldLabel>
          )}
          {canReset && (
            <Button
              ref={resetButton}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={messages('reset', { label: field.label })}
              aria-label={messages('reset', { label: field.label })}
              disabled={setting.pending}
              onClick={reset}
            >
              <Undo3Icon aria-hidden="true" />
            </Button>
          )}
        </div>
        {field.description && (
          <FieldDescription id={ids.description}>{field.description}</FieldDescription>
        )}
        {horizontal && feedback}
      </FieldContent>
      {Control ? (
        <Control
          field={field}
          id={ids.control}
          value={draft ? draft.value : setting.value}
          onChange={(value: unknown) => write(() => setting.set(value), value)}
          disabled={disabled}
          describedBy={describedBy}
        />
      ) : (
        <p id={ids.control} className="text-sm text-muted-foreground">
          {messages('unsupported')}
        </p>
      )}
      {!horizontal && feedback}
    </Field>
  );
}
