'use client';

import { useTranslations } from 'next-intl';

import { Fragment } from 'react';
import { useSettingsSections } from '@bitakit/app-preferences';
import { projectSettings } from '@/settings/projection';
import { SettingsLink } from '@/components/settings/base/settings-link';
import { Separator } from '@/components/ui/separator';
import { parseAsString, useQueryState } from 'nuqs';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import SearchIcon from 'reicon-react/icons/Search';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupClearButton,
} from '@/components/ui/input-group';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export function SettingsOverview() {
  const t = useTranslations('Settings');
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ history: 'replace' }),
  );
  const sections = useSettingsSections();
  const groups = projectSettings(sections, query);
  const count = groups.reduce((total, group) => total + group.entries.length, 0);
  return (
    <>
      <Field>
        <FieldLabel htmlFor="settings-search">{t('search')}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="settings-search"
            type="text"
            placeholder={t('placeholder')}
            value={query}
            onChange={(event) => {
              void setQuery(event.target.value);
            }}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupClearButton
                aria-label={t('clear')}
                onClear={() => {
                  void setQuery(null);
                }}
              />
            </InputGroupAddon>
          )}
        </InputGroup>
      </Field>
      <p role="status" className="sr-only">
        {t('count', { count })}
      </p>
      {groups.map(({ group, entries }, index) => (
        <Fragment key={group?.id ?? index}>
          {entries[0]?.dividerBefore && <Separator />}
          <section aria-label={group?.title} className="flex flex-col gap-3">
            {group && (
              <div>
                <h2 className="text-sm font-medium">{group.title}</h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
            )}
            <ItemGroup>
              {entries.map(({ action, dividerBefore }, entryIndex) => (
                <div role="listitem" key={action.id}>
                  {entryIndex > 0 && dividerBefore && <Separator className="my-2" />}
                  <Item asChild variant="outline">
                    <SettingsLink
                      href={action.enabled ? action.href : '#'}
                      aria-disabled={!action.enabled || undefined}
                      tabIndex={action.enabled ? undefined : -1}
                    >
                      {action.icon && (
                        <ItemMedia variant="icon">
                          <action.icon aria-hidden="true" />
                        </ItemMedia>
                      )}
                      <ItemContent>
                        <ItemTitle>{action.title}</ItemTitle>
                        <ItemDescription>{action.description}</ItemDescription>
                      </ItemContent>
                      <ChevronRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </SettingsLink>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          </section>
        </Fragment>
      ))}
      {!count && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('empty')}</EmptyTitle>
            <EmptyDescription>{t('hint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => {
                void setQuery(null);
              }}
            >
              {t('clearSearch')}
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
