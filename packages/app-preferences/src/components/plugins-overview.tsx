'use client';
import { Suspense, useId, useMemo, type ReactNode } from 'react';
import { createSerializer, parseAsString, useQueryStates } from 'nuqs';
import { safeHref } from '@bitakit/core';
import { useFoundation, useSettingsCatalog, useTranslation } from '@bitakit/ui';
import { Badge } from '@bitakit/ui/components';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import { visibleSections } from '../catalog.js';
import { pluginId } from '../id.js';
import { normalizePath, sectionHref } from '../paths.js';
import { BackLink } from './back-link.js';
import { iconOf, type IconComponent } from './icon.js';
import { useSettingsLocation } from './location.js';
import { SearchField } from './search-field.js';
import { SettingsFields } from './settings-fields.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty.js';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from './ui/item.js';
import { useMessages } from './use-messages.js';

const parsers = {
  plugin: parseAsString.withDefault('').withOptions({ history: 'push' }),
  pluginSearch: parseAsString.withDefault('').withOptions({ history: 'replace' }),
  q: parseAsString.withDefault(''),
};
const serialize = createSerializer(parsers);
type View = { plugin: string; pluginSearch: string; q: string };

type PluginEntry = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  homepage?: string;
  support?: string;
  cover?: string;
  icon: IconComponent;
};
/** Installed plugins with their metadata; `plugins.<id>.name|description` translate it. */
function usePlugins(): readonly PluginEntry[] {
  const { runtime } = useFoundation();
  const t = useTranslation();
  return useMemo(() => {
    const appId = runtime.config.appId ?? 'app';
    return runtime.modules
      .filter((module) => module.id !== appId)
      .map((module) => {
        const meta = module.metadata;
        return {
          id: module.id,
          name: t(`plugins.${module.id}.name`, undefined, meta?.name ?? module.id),
          description:
            t(`plugins.${module.id}.description`, undefined, meta?.description ?? '') || undefined,
          version: meta?.version,
          author: typeof meta?.author === 'string' ? meta.author : meta?.author?.name,
          license: meta?.license,
          homepage: safeHref(meta?.homepage),
          support: safeHref(typeof meta?.bugs === 'string' ? meta.bugs : meta?.bugs?.url),
          cover: safeHref(meta?.coverImage),
          icon: iconOf(meta?.icon) ?? PuzzleIcon,
        };
      });
  }, [runtime, t]);
}

function PluginMedia({ plugin }: { plugin: PluginEntry }) {
  const Icon = plugin.icon;
  return plugin.cover ? (
    <ItemMedia variant="image">
      <img
        src={plugin.cover}
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
    </ItemMedia>
  ) : (
    <ItemMedia variant="icon">
      <Icon aria-hidden="true" />
    </ItemMedia>
  );
}

function PluginDetail({ plugin, back }: { plugin: PluginEntry; back: ReactNode }) {
  const messages = useMessages();
  const location = useSettingsLocation({});
  const id = useId();
  const section = visibleSections(useSettingsCatalog()).find((entry) => entry.id === plugin.id);
  const { Link } = location;
  const ownPage = section?.component && section.id !== pluginId;
  return (
    <section aria-labelledby={`${id}title`} className="flex w-full min-w-0 flex-col gap-6">
      {back}
      <Item variant="muted">
        <PluginMedia plugin={plugin} />
        <ItemContent className="min-w-0">
          <ItemTitle>
            <h2 id={`${id}title`}>{plugin.name}</h2>
            {plugin.version && <Badge variant="secondary">{plugin.version}</Badge>}
          </ItemTitle>
          {plugin.author && (
            <ItemDescription>{messages('author', { author: plugin.author })}</ItemDescription>
          )}
        </ItemContent>
      </Item>
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <section aria-labelledby={`${id}about`} className="flex min-w-0 flex-col gap-3">
            <h3 id={`${id}about`} className="text-sm font-medium">
              {messages('aboutPlugin')}
            </h3>
            <p className="text-sm text-muted-foreground wrap-anywhere">
              {plugin.description ?? messages('noDescription')}
            </p>
          </section>
          <section aria-labelledby={`${id}settings`} className="flex min-w-0 flex-col gap-3">
            <h3 id={`${id}settings`} className="text-sm font-medium">
              {messages('pluginSettings')}
            </h3>
            {section && ownPage ? (
              <Item asChild variant="outline">
                <Link href={sectionHref(location.basePath, section)}>
                  <ItemContent className="min-w-0">
                    <ItemTitle>{section.title}</ItemTitle>
                    <ItemDescription>{messages('openSettings')}</ItemDescription>
                  </ItemContent>
                  <ChevronRightIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </Item>
            ) : section?.fields.length ? (
              <SettingsFields section={section} />
            ) : (
              <p className="text-sm text-muted-foreground">{messages('noPluginSettings')}</p>
            )}
          </section>
        </div>
        <aside aria-labelledby={`${id}information`} className="min-w-0">
          <Card size="sm">
            <CardHeader>
              <CardTitle id={`${id}information`}>{messages('information')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4 text-sm wrap-anywhere">
                <div className="flex flex-col gap-1.5">
                  <dt className="text-muted-foreground">{messages('version')}</dt>
                  <dd>
                    {plugin.version ? (
                      <Badge variant="secondary">{plugin.version}</Badge>
                    ) : (
                      messages('unspecified')
                    )}
                  </dd>
                </div>
                {plugin.license && (
                  <div className="flex flex-col gap-1.5">
                    <dt className="text-muted-foreground">{messages('license')}</dt>
                    <dd>{plugin.license}</dd>
                  </div>
                )}
                {plugin.homepage && (
                  <div className="flex flex-col gap-1.5">
                    <dt className="text-muted-foreground">{messages('website')}</dt>
                    <dd>
                      <a href={plugin.homepage} className="underline underline-offset-4">
                        {messages('projectWebsite')}
                      </a>
                    </dd>
                  </div>
                )}
                {plugin.support && (
                  <div className="flex flex-col gap-1.5">
                    <dt className="text-muted-foreground">{messages('support')}</dt>
                    <dd>
                      <a href={plugin.support} className="underline underline-offset-4">
                        {messages('supportLink')}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function PluginsView({
  view,
  onSearch,
}: {
  view: View;
  onSearch?: (value: string | null) => void;
}) {
  const messages = useMessages();
  const plugins = usePlugins();
  const location = useSettingsLocation({});
  const catalog = useSettingsCatalog();
  const { Link } = location;
  const own = catalog.find((section) => section.id === pluginId);
  const here =
    location.pathname === undefined
      ? sectionHref(location.basePath, own ?? { path: 'plugins' })
      : normalizePath(location.pathname);
  const href = (plugin: string) => serialize(here, { ...view, plugin });
  if (view.plugin) {
    const back = (
      <BackLink as={Link} href={href('')}>
        {messages('backToPlugins')}
      </BackLink>
    );
    const plugin = plugins.find((entry) => entry.id === view.plugin);
    if (plugin) return <PluginDetail plugin={plugin} back={back} />;
    return (
      <div className="flex w-full min-w-0 flex-col gap-6">
        {back}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PuzzleIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{messages('pluginUnavailable')}</EmptyTitle>
            <EmptyDescription>{messages('pluginUnavailableHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  const terms = view.pluginSearch.trim().toLocaleLowerCase();
  const entries = plugins.filter((plugin) =>
    `${plugin.name} ${plugin.description ?? ''}`.toLocaleLowerCase().includes(terms),
  );
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="w-full sm:max-w-xs">
        <SearchField
          label={messages('searchPlugins')}
          placeholder={messages('searchPluginsPlaceholder')}
          clearLabel={messages('clearPluginSearch')}
          value={view.pluginSearch}
          onValueChange={onSearch}
        />
      </div>
      <ul aria-label={messages('plugins')} className="grid w-full list-none grid-cols-1 gap-4 p-0">
        {entries.map((plugin) => (
          <li key={plugin.id} className="min-w-0">
            <Item asChild variant="outline" className="h-full">
              <Link href={href(plugin.id)}>
                <PluginMedia plugin={plugin} />
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    {plugin.name}
                    {plugin.version && <Badge variant="secondary">{plugin.version}</Badge>}
                  </ItemTitle>
                  {plugin.description && <ItemDescription>{plugin.description}</ItemDescription>}
                  {plugin.author && (
                    <ItemDescription>
                      {messages('author', { author: plugin.author })}
                    </ItemDescription>
                  )}
                </ItemContent>
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </Item>
          </li>
        ))}
      </ul>
      {!entries.length && (
        <p role="status" className="text-sm text-muted-foreground">
          {messages('noPlugins')}
        </p>
      )}
    </div>
  );
}
function SearchablePlugins() {
  const [view, setView] = useQueryStates(parsers);
  return <PluginsView view={view} onSearch={(value) => void setView({ pluginSearch: value })} />;
}

/**
 * The plugin overview: installed plugins with their metadata, searchable, and one plugin's
 * details with its settings when `?plugin=<id>` is set. App Preferences' own settings page.
 */
export function PluginsOverview() {
  return (
    <Suspense fallback={<PluginsView view={{ plugin: '', pluginSearch: '', q: '' }} />}>
      <SearchablePlugins />
    </Suspense>
  );
}
