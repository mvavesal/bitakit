'use client';
import { useId, useState } from 'react';
import { useSetting, useTranslation } from '@bitakit/ui';
import { SwitchControl } from '@bitakit/app-preferences';
import SearchIcon from 'reicon-react/icons/Search';
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from '@bitakit/ui/components';
import { sourceEnabled } from '../service.js';
import { useSources, useSearchText } from './use-sources.js';
import type { RegisteredSource } from '../types.js';

/** Source choices are confirmed by the runtime and edited from App Settings. */
export function SourcePreferences() {
  const sources = useSources();
  return (
    <FieldGroup className="quick-search-sources">
      {sources.map((source) => (
        <SourcePreference key={source.id} source={source} />
      ))}
    </FieldGroup>
  );
}
function SourcePreference({ source }: { source: RegisteredSource }) {
  const setting = useSetting('quick-search.sources');
  const text = useSearchText();
  const t = useTranslation();
  const id = useId();
  const [failed, setFailed] = useState(false);
  const label = text(source.source.title);
  const Icon = source.source.icon ?? SearchIcon;
  const enabled = sourceEnabled(source, setting.value);
  const onChange = (enabled: boolean) => {
    setFailed(false);
    void setting.set({ ...setting.value, [source.id]: enabled }).catch(() => setFailed(true));
  };
  const error = (failed || setting.error) && (
    <FieldError>
      {t('quickSearch.saveError', undefined, 'Could not save your preference. Try again.')}
    </FieldError>
  );
  return (
    <Field orientation="horizontal">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription id={`${id}-description`}>
          {text(source.source.description)}
        </FieldDescription>
        {error}
      </FieldContent>
      <SwitchControl
        id={id}
        field={{
          key: setting.key,
          plugin: 'quick-search',
          name: 'sources',
          label,
          spec: setting.definition,
        }}
        value={enabled}
        disabled={setting.disabled}
        describedBy={`${id}-description`}
        onChange={onChange}
      />
    </Field>
  );
}
