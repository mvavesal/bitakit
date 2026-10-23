'use client';
import { Fragment, useId, useState } from 'react';
import { useSetting, useTranslation } from '@bitakit/ui';
import { SwitchControl } from '@bitakit/app-preferences';
import SearchIcon from 'reicon-react/icons/Search';
import {
  Field,
  FieldContent,
  FieldLabel,
  ItemDescription,
  FieldError,
  Card,
  Item,
  ItemMedia,
  ItemGroup,
  ItemSeparator,
} from '@bitakit/ui/components';
import { sourceEnabled } from '../service.js';
import { useSources, useSearchText } from './use-sources.js';
import type { RegisteredSource } from '../types.js';

/** Source choices are confirmed by the runtime and edited from App Settings. */
export function SourcePreferences() {
  const sources = useSources();
  return (
    <Card size="sm" className="py-0">
      <ItemGroup className="quick-search-sources gap-0 has-data-[size=xs]:gap-0">
        {sources.map((source, index) => (
          <Fragment key={source.id}>
            <Item size="xs" role="listitem">
              <SourcePreference source={source} />
            </Item>
            {index < sources.length - 1 && <ItemSeparator className="my-0" />}
          </Fragment>
        ))}
      </ItemGroup>
    </Card>
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
      <ItemMedia variant="icon">
        <Icon aria-hidden="true" />
      </ItemMedia>
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <ItemDescription className="line-clamp-none wrap-anywhere" id={`${id}-description`}>
          {text(source.source.description)}
        </ItemDescription>
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
