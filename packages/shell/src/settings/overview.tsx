'use client';
import { useTranslation } from '@bitakit/ui';

import type { ElementType } from 'react';

import { Fragment, useContext } from 'react';
import {  BackLink  } from '../components/ui/index.js';
import {  PageHeader  } from '../components/ui/index.js';
import { SettingsNavigationLink } from './link.js';
import {  Badge  } from '../components/ui/index.js';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import { useFoundation } from '@bitakit/ui';
import { safeHref } from '@bitakit/core';
export function PluginSettingsOverview() {
  const t = useTranslation();
  const Link = useContext(SettingsNavigationLink);
  const { runtime } = useFoundation();
  const sections = useSettingsSections();
  const [query, setQuery] = useQueryState(
    'pluginSearch',
    parseAsString.withDefault('').withOptions({ history: 'replace' }),
  );
  const [selected] = useQueryState(
    'plugin',
    parseAsString.withDefault('').withOptions({ history: 'push' }),
  );
  const plugins = (runtime.config.plugins ?? []).map(plugin => ({ ...plugin, metadata: plugin.metadata ? {
    ...plugin.metadata,
    name: t(`plugins.${plugin.id}.name`, undefined, plugin.metadata.name ?? plugin.id),
    description: t(`plugins.${plugin.id}.description`, undefined, plugin.metadata.description ?? ''),
  } : undefined }));
  const plugin = plugins.find((item) => item.id === selected);
  const listHref = query
    ? `/settings/plugins?${new URLSearchParams({ pluginSearch: query })}`
    : '/settings/plugins';
  if (selected) {
    const back = (
      <BackLink as={Link} href={listHref}>
        {t("shell.ui.backPlugins", undefined, "Back to plugins")}
      </BackLink>
    );
    if (!plugin)
      return (
        <section className="flex w-full min-w-0 flex-col gap-6">
          {back}
          <PageHeader title={t("shell.ui.pluginUnavailable", undefined, "Plugin unavailable")} />
        </section>
      );
    const meta = plugin.metadata;
    const Icon = meta?.icon ?? PuzzleIcon;
    const author = typeof meta?.author === 'string' ? meta.author : meta?.author?.name;
    const homepage = safeHref(meta?.homepage);
    const support = safeHref(typeof meta?.bugs === 'string' ? meta.bugs : meta?.bugs?.url);
    const owned = sections.filter((section) => section.pluginId === plugin.id && section.visible);
    return (
      <section className="flex w-full min-w-0 flex-col gap-6">
        {back}
        <div className="flex items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            data-corner="theme"
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <PageHeader
            className="min-w-0 flex-1"
            title={meta?.name ?? plugin.id}
            subtitle={author ? t('shell.ui.author', { author }, `Von ${author}`) : undefined}
          />
        </div>
        <div className="grid min-w-0 gap-8 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
            <section className="flex flex-col gap-3" aria-label={t("shell.ui.description", undefined, "Description")}>
              <h2 className="text-base font-medium">{t("shell.ui.aboutPlugin", undefined, "About this plugin")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {meta?.description ?? t("shell.ui.noDescription", undefined, "No description is available for this plugin.")}
              </p>
            </section>
            <section className="flex flex-col gap-3" aria-label={t("shell.ui.pluginSettings", undefined, "Plugin settings")}>
              <h2 className="text-base font-medium">{t("shell.ui.settings", undefined, "Settings")}</h2>
              {owned.length ? (
                <ItemGroup>
                  {owned.map((section) => (
                    <Item key={section.id} asChild variant="outline">
                      <Link
                        href={section.enabled ? `/settings/${section.path}` : '#'}
                        aria-disabled={!section.enabled || undefined}
                        tabIndex={section.enabled ? undefined : -1}
                      >
                        {section.icon && (
                          <ItemMedia variant="icon">
                            <section.icon aria-hidden="true" />
                          </ItemMedia>
                        )}
                        <ItemContent>
                          <ItemTitle>{section.title}</ItemTitle>
                          {section.description && (
                            <ItemDescription>{section.description}</ItemDescription>
                          )}
                        </ItemContent>
                        <ChevronRightIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Link>
                    </Item>
                  ))}
                </ItemGroup>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("shell.ui.noSettings", undefined, "This plugin has no settings.")}
                </p>
              )}
            </section>
          </div>
          <aside
            className="min-w-0 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
            aria-label={t("shell.ui.pluginInfo", undefined, "Plugin information")}
          >
            <h2 className="mb-4 text-base font-medium">{t("shell.ui.info", undefined, "Information")}</h2>
            <dl className="flex flex-col gap-5 text-sm [overflow-wrap:anywhere]">
              <div className="flex flex-col gap-1.5">
                <dt className="text-muted-foreground">{t("shell.ui.version", undefined, "Version")}</dt>
                <dd>
                  {meta?.version ? (
                    <Badge variant="secondary">{meta.version}</Badge>
                  ) : (
                    t("shell.ui.unspecified", undefined, "Not specified")
                  )}
                </dd>
              </div>
              {meta?.license && (
                <div className="flex flex-col gap-1.5">
                  <dt className="text-muted-foreground">{t("shell.ui.license", undefined, "License")}</dt>
                  <dd>{meta.license}</dd>
                </div>
              )}
              {homepage && (
                <div className="flex flex-col gap-1.5">
                  <dt className="text-muted-foreground">{t("shell.ui.website", undefined, "Website")}</dt>
                  <dd>
                    <a href={homepage} className="underline underline-offset-4">
                      {t("shell.ui.projectWebsite", undefined, "Project website")}
                    </a>
                  </dd>
                </div>
              )}
              {support && (
                <div className="flex flex-col gap-1.5">
                  <dt className="text-muted-foreground">{t("shell.ui.support", undefined, "Support")}</dt>
                  <dd>
                    <a href={support} className="underline underline-offset-4">
                      {t("shell.ui.supportLink", undefined, "Get help and report issues")}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </section>
    );
  }
  const entries = plugins.filter((item) =>
    `${item.metadata?.name ?? item.id} ${item.metadata?.description ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader title={t("shell.ui.plugins", undefined, "Plugins")} subtitle={t("shell.ui.pluginsDescription", undefined, "Active extensions and their settings.")} />
      <div className="flex min-w-0 flex-col gap-4">
      <InputGroup className="w-full sm:max-w-xs">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          aria-label={t("shell.ui.searchPlugins", undefined, "Search plugins")}
          placeholder={t("shell.ui.pluginsPlaceholder", undefined, "Search plugins…")}
          value={query}
          onChange={(event) => {
            void setQuery(event.target.value);
          }}
        />
        {query && (
          <InputGroupAddon align="inline-end">
            <InputGroupClearButton
              aria-label={t("shell.ui.clearPlugins", undefined, "Clear plugin search")}
              onClear={() => {
                void setQuery(null);
              }}
            />
          </InputGroupAddon>
        )}
      </InputGroup>
      <ul aria-label={t("shell.ui.plugins", undefined, "Plugins")} className="grid w-full list-none grid-cols-1 gap-4 p-0">
        {entries.map((item) => {
          const Icon = item.metadata?.icon ?? PuzzleIcon;
          const name = item.metadata?.name ?? item.id;
          const cover = safeHref(item.metadata?.coverImage);
          const author =
            typeof item.metadata?.author === 'string'
              ? item.metadata.author
              : item.metadata?.author?.name;
          return (
            <li key={item.id} className="min-w-0">
              <Item asChild variant="outline" className="h-full">
                <Link
                  aria-label={t('shell.ui.openPlugin', { name }, `Open ${name}`)}
                  href={`/settings/plugins?${new URLSearchParams({ ...(query ? { pluginSearch: query } : {}), plugin: item.id })}`}
                >
                  <ItemMedia variant={cover ? 'image' : 'icon'}>
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="object-cover"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    ) : (
                      <Icon aria-hidden="true" />
                    )}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {name}
                      {item.metadata?.version && (
                        <Badge variant="secondary">{item.metadata.version}</Badge>
                      )}
                    </ItemTitle>
                    {item.metadata?.description && (
                      <ItemDescription>{item.metadata.description}</ItemDescription>
                    )}
                    {author && <p className="text-xs text-muted-foreground">Von {author}</p>}
                  </ItemContent>
                  <ChevronRightIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </Item>
            </li>
          );
        })}
      </ul>
      {!entries.length && <p className="text-sm text-muted-foreground">{t('shell.ui.noPlugins', undefined, 'No plugins found.')}</p>}
      </div>
    </section>
  );
}
import { useSettingsSections } from '@bitakit/app-preferences';
import { projectSettings } from '@bitakit/app-preferences/core';

import {  Separator  } from '../components/ui/index.js';
import { parseAsString, useQueryState } from 'nuqs';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import SearchIcon from 'reicon-react/icons/Search';
import {  Button  } from '../components/ui/index.js';
import { 
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupClearButton,
 } from '../components/ui/index.js';
import {  Field, FieldLabel  } from '../components/ui/index.js';
import { 
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
 } from '../components/ui/index.js';
import { 
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
 } from '../components/ui/index.js';

export function SettingsOverview({
  linkComponent,
  category,
  showSearch = true,
}: {
  linkComponent?: ElementType;
  showSearch?: boolean;
  category?: string;
}) {
  const defaultLink = useContext(SettingsNavigationLink);
  const SettingsLink = linkComponent ?? defaultLink;
  const labels = {
    search: 'Search settings',
    placeholder: 'Search settings…',
    clear: 'Clear search',
    empty: 'No settings found',
    hint: 'Try another search term.',
    clearSearch: 'Reset search',
  };
  const translate = useTranslation();
  const t = (key: keyof typeof labels) => translate(`shell.overview.${key}`, undefined, labels[key]);
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ history: 'replace' }),
  );
  const sections = useSettingsSections().filter((section) => !section.scope);
  const groups = projectSettings(
    sections.filter(
      (section) =>
        (section.component || section.groups.length || section.fields.length) &&
        (!category || section.category?.id === category),
    ),
    query,
  );
  const count = groups.reduce((total, group) => total + group.entries.length, 0);
  return (
    <>
      {showSearch && (
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
      )}
      <p role="status" className="sr-only">
        {count} settings
      </p>
      {groups.map(({ group, entries }, index) => (
        <Fragment key={group?.id ?? index}>
          {entries[0]?.dividerBefore && <Separator />}
          <section aria-label={group?.title} className="flex flex-col gap-3">
            {group && (
              <div>
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground">
                  {group.title}
                </h2>
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
