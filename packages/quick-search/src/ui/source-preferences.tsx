'use client';
import { useId, useState } from 'react';
import { useSetting, useTranslation } from '@bitakit/ui';
import { SwitchControl } from '@bitakit/app-preferences';
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

/** Both settings and the palette edit the same confirmed runtime-owned override record. */
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
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription id={`${id}-description`}>
          {text(source.source.description)}
        </FieldDescription>
        {(failed || setting.error) && (
          <FieldError>
            {t('quickSearch.saveError', undefined, 'Could not save your preference. Try again.')}
          </FieldError>
        )}
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
        value={sourceEnabled(source, setting.value)}
        disabled={setting.disabled}
        describedBy={`${id}-description`}
        onChange={(enabled) => {
          setFailed(false);
          void setting.set({ ...setting.value, [source.id]: enabled }).catch(() => setFailed(true));
        }}
      />
    </Field>
  );
}
