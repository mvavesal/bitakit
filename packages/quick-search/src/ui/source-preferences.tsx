'use client';
import { useId, useState } from 'react';
import { useSetting, useTranslation } from '@bitakit/ui';
import { SwitchControl } from '@bitakit/app-preferences';
import SearchIcon from 'reicon-react/icons/Search';
import {
  Button,
  Field,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from '@bitakit/ui/components';
import { sourceEnabled } from '../service.js';
import { useSources, useSearchText } from './use-sources.js';
import type { RegisteredSource } from '../types.js';

/** Both settings and the palette edit the same confirmed runtime-owned override record. */
export function SourcePreferences({
  presentation = 'switches',
}: {
  presentation?: 'switches' | 'buttons';
}) {
  const sources = useSources();
  const t = useTranslation();
  if (presentation === 'buttons')
    return (
      <Field
        className="quick-search-sources"
        aria-label={t('quickSearch.sourceSettings', undefined, 'Search sources')}
      >
        <FieldTitle>{t('quickSearch.sourceSettings', undefined, 'Search sources')}</FieldTitle>
        <FieldDescription>
          {t('quickSearch.sourcesHint', undefined, 'Your source choices are saved.')}
        </FieldDescription>
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <SourcePreference key={source.id} source={source} presentation={presentation} />
          ))}
        </div>
      </Field>
    );
  return (
    <FieldGroup className="quick-search-sources">
      {sources.map((source) => (
        <SourcePreference key={source.id} source={source} />
      ))}
    </FieldGroup>
  );
}
function SourcePreference({
  source,
  presentation = 'switches',
}: {
  source: RegisteredSource;
  presentation?: 'switches' | 'buttons';
}) {
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
  if (presentation === 'buttons')
    return (
      <div className="min-w-0 max-w-full">
        <Button
          className="max-w-full"
          size="sm"
          variant={enabled ? 'secondary' : 'outline'}
          aria-label={label}
          aria-pressed={enabled}
          disabled={setting.disabled}
          onClick={() => onChange(!enabled)}
        >
          <Icon aria-hidden="true" />
          <span className="min-w-0 truncate">{label}</span>
          <span>
            {enabled
              ? t('quickSearch.on', undefined, 'On')
              : t('quickSearch.off', undefined, 'Off')}
          </span>
        </Button>
        {error}
      </div>
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
