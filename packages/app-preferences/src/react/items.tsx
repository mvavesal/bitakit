'use client';
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Setting } from '../fields/setting.js';
import { SettingValidationError } from '../fields/setting.js';
import { MultiSelectSetting } from '../fields/multi-select-setting.js';
import { SelectSetting } from '../fields/select-setting.js';
import type { SaveResult, SettingState, SettingValue } from '../types.js';
import type { ResolvedControl } from '../renderers/registry.js';
import type { SettingsFieldViewProps, SettingsSectionItem } from '../renderers/types.js';
import { useSettings } from './provider.js';
import { settingsText, useSettingsUI } from './ui-context.js';
import { formatMessage, type SettingsMessages } from './messages.js';

import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
  FieldDescription,
  FieldError,
} from '../components/ui/field.js';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert.js';
import ResetIcon from 'reicon-react/icons/Undo3';
import { Button } from '../components/ui/button.js';

const initialStates = new WeakMap<Setting<any>, SettingState<any>>();
/** The state every definition has before it is registered and loaded; identical on server and client. */
function initialState(setting: Setting<any>) {
  let state = initialStates.get(setting);
  if (!state) {
    state = Object.freeze({
      value: setting.defaultValue,
      ready: false,
      writable: false,
      visible: setting.visible,
      pending: false,
    });
    initialStates.set(setting, state);
  }
  return state;
}
const reported = new Set<string>();
function report(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (reported.has(message)) return;
  reported.add(message);
  console.error(error);
}
const noop = () => {};
export function ConfigurationAlert({
  messages,
  children,
}: {
  messages: SettingsMessages;
  children: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{messages.configuration}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
function Feedback({
  id,
  error,
  pending,
  readOnly,
  messages,
}: {
  id: string;
  error?: string;
  pending: boolean;
  readOnly: boolean;
  messages: SettingsMessages;
}) {
  return (
    <div id={id} data-slot="settings-feedback" className="text-sm empty:hidden">
      {error ? (
        <FieldError>{error}</FieldError>
      ) : pending ? (
        <p role="status" className="text-muted-foreground">
          {messages.saving}
        </p>
      ) : readOnly ? (
        <p className="text-muted-foreground">{messages.readOnly}</p>
      ) : null}
    </div>
  );
}
/** Default field layout: label and description, then the control and its feedback. */
export function DefaultFieldView({ item }: SettingsFieldViewProps) {
  const horizontal = item.setting.type === 'boolean';
  return (
    <Field
      data-slot="settings-field"
      orientation={horizontal ? 'horizontal' : 'vertical'}
      data-invalid={!!item.state?.error || undefined}
      data-disabled={(item.state && (!item.state.ready || !item.state.writable)) || undefined}
    >
      <FieldContent>
        <div className="flex items-center justify-between gap-2">
          {item.label}
          {item.resetControl}
        </div>
        {item.description}
        {horizontal && item.feedback}
      </FieldContent>
      {item.control}
      {!horizontal && item.feedback}
    </Field>
  );
}
/**
 * Binds definitions to confirmed state, local drafts, ids and resolved renderers. Items expose
 * pre-connected parts so custom layouts keep label, description and error associations.
 */
export function useSettingsItems(
  fields: readonly Setting<any>[],
  options: { disabled?: boolean } = {},
): SettingsSectionItem[] {
  const settings = useSettings();
  const ui = useSettingsUI();
  const prefix = useId();
  const text = useMemo(() => settingsText(ui.translate), [ui.translate]);
  const cache = useRef<readonly (SettingState<any> | undefined)[]>([]);
  const subscribe = useCallback(
    (listener: () => void) => {
      const offs = fields.map((field) => settings.subscribe(field, listener));
      offs.push(settings.subscribeDefinitions(listener));
      return () => offs.forEach((off) => off());
    },
    [settings, fields],
  );
  const read = useCallback(() => {
    const next = fields.map((field) =>
      settings.has(field)
        ? settings.get(field)
        : ui.initial?.settings.has(field)
          ? initialState(field)
          : undefined,
    );
    const previous = cache.current;
    if (previous.length === next.length && next.every((state, index) => state === previous[index]))
      return previous;
    cache.current = next;
    return next;
  }, [settings, fields, ui.initial]);
  const states = useSyncExternalStore(subscribe, read, read);
  const [drafts, setDrafts] = useState<ReadonlyMap<string, { value: SettingValue; token: number }>>(
    () => new Map(),
  );
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map());
  const tokens = useRef(0);
  const write = useCallback(
    (setting: Setting<any>, run: () => Promise<SaveResult>, draft?: { value: SettingValue }) => {
      const key = setting.key;
      const token = ++tokens.current;
      if (draft) setDrafts((map) => new Map(map).set(key, { value: draft.value, token }));
      setErrors((map) => {
        if (!map.has(key)) return map;
        const next = new Map(map);
        next.delete(key);
        return next;
      });
      const settle = () =>
        setDrafts((map) => {
          if (map.get(key)?.token !== token) return map;
          const next = new Map(map);
          next.delete(key);
          return next;
        });
      const promise = run();
      promise.then(settle, (error: unknown) => {
        settle();
        // Write failures are published by AppPreferences; only local rejections need a message here.
        if (settings.has(setting) && settings.get(setting).error) return;
        const message =
          error instanceof SettingValidationError
            ? (error.issue ?? ui.messages.invalid)
            : error instanceof Error
              ? error.message
              : ui.messages.saveFailed;
        setErrors((map) => new Map(map).set(key, message));
      });
      promise.catch(noop);
      return promise;
    },
    [settings, ui.messages],
  );
  const FieldView = useMemo(() => {
    try {
      return ui.renderers.resolveView('field') ?? DefaultFieldView;
    } catch (error) {
      report(error);
      return DefaultFieldView;
    }
  }, [ui.renderers]);
  return fields.map((setting, index) => {
    const state = states[index];
    const base = `${prefix}${index}`;
    const labelText = text.fieldLabel(setting);
    const descriptionText = text.fieldDescription(setting);
    const ids = {
      id: `${base}-control`,
      labelId: `${base}-label`,
      descriptionId: descriptionText ? `${base}-description` : undefined,
      feedbackId: `${base}-feedback`,
    };
    const description = descriptionText ? (
      <FieldDescription id={ids.descriptionId}>{descriptionText}</FieldDescription>
    ) : null;
    const broken = (message: string): SettingsSectionItem => {
      const alert = <ConfigurationAlert messages={ui.messages}>{message}</ConfigurationAlert>;
      return Object.freeze({
        key: setting.key,
        setting,
        state,
        label: <FieldTitle id={ids.labelId}>{labelText}</FieldTitle>,
        description,
        control: alert,
        feedback: null,
        resetControl: null,
        content: alert,
        labelText,
        descriptionText,
        group: false,
        ids: {
          controlId: ids.id,
          labelId: ids.labelId,
          descriptionId: ids.descriptionId,
          feedbackId: ids.feedbackId,
        },
      });
    };
    if (!state) return broken(formatMessage(ui.messages.unregistered, { key: setting.key }));
    let resolved: ResolvedControl;
    try {
      resolved = ui.renderers.resolveField(
        setting,
        ui.initial ? ui.initial.owners(setting.key) : settings.ownersOf(setting),
      );
    } catch (error) {
      report(error);
      return broken(error instanceof Error ? error.message : String(error));
    }
    const draft = drafts.get(setting.key);
    const errorText =
      errors.get(setting.key) ??
      (state.error ? (state.ready ? ui.messages.saveFailed : ui.messages.loadFailed) : undefined);
    const reset = () =>
      write(setting, () => settings.reset(setting), { value: setting.defaultValue });
    const props: Record<string, unknown> = {
      setting,
      value: draft ? draft.value : state.value,
      confirmedValue: state.value,
      setValue: (value: SettingValue) =>
        write(setting, () => settings.set(setting, value), { value }),
      reset,
      ready: state.ready,
      writable: state.writable,
      disabled: !!options.disabled || !state.ready || !state.writable,
      pending: state.pending,
      error: errorText,
      label: labelText,
      description: descriptionText,
      presentation: setting.presentation,
      ...ids,
      describedBy: [ids.descriptionId, ids.feedbackId].filter(Boolean).join(' '),
      messages: ui.messages,
    };
    if (setting instanceof SelectSetting || setting instanceof MultiSelectSetting)
      props.options = setting.options.map((option) => text.option(setting, option));
    const Control = resolved.component;
    const label = resolved.group ? (
      <FieldTitle id={ids.labelId}>{labelText}</FieldTitle>
    ) : (
      <FieldLabel id={ids.labelId} htmlFor={ids.id}>
        {labelText}
      </FieldLabel>
    );
    const item: { -readonly [K in keyof SettingsSectionItem]: SettingsSectionItem[K] } = {
      key: setting.key,
      setting,
      state,
      label,
      description,
      control: <Control {...props} />,
      resetControl: (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={ui.messages.reset}
          aria-label={`${ui.messages.reset}: ${labelText}`}
          aria-describedby={ids.feedbackId}
          disabled={!!options.disabled || !state.ready || !state.writable || state.pending}
          onClick={() => {
            void reset().catch(noop);
          }}
        >
          <ResetIcon aria-hidden="true" />
        </Button>
      ),
      feedback: (
        <Feedback
          id={ids.feedbackId}
          error={errorText}
          pending={state.pending}
          readOnly={state.ready && !state.writable}
          messages={ui.messages}
        />
      ),
      content: null,
      labelText,
      descriptionText,
      group: resolved.group,
      ids: {
        controlId: ids.id,
        labelId: ids.labelId,
        descriptionId: ids.descriptionId,
        feedbackId: ids.feedbackId,
      },
    };
    item.content = <FieldView item={item} />;
    return Object.freeze(item);
  });
}
