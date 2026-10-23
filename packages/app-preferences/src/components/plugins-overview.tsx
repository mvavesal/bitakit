'use client';
import { Fragment, Suspense, useId, useMemo, useState, type ReactNode } from 'react';
import {
  createSerializer,
  parseAsNativeArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { safeHref } from '@bitakit/core';
import { useBitaKit, useSettingsCatalog, useTranslation, useRuntimeInventory } from '@bitakit/ui';
import {
  Badge,
  Button,
  PageHeader,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@bitakit/ui/components';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import SearchIcon from 'reicon-react/icons/Search';
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
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from './ui/item.js';
import { ScrollArea } from './ui/scroll-area.js';

import { useMessages } from './use-messages.js';
import { PluginToggle, PluginChangeFeedback } from './plugin-toggle.js';

const statuses = ['all', 'enabled', 'disabled'] as const;
type PluginStatus = (typeof statuses)[number];
const parsers = {
  plugin: parseAsString.withDefault('').withOptions({ history: 'push' }),
  pluginSearch: parseAsString.withDefault('').withOptions({ history: 'replace' }),
  pluginTag: parseAsNativeArrayOf(parseAsString).withOptions({ history: 'replace' }),
  pluginStatus: parseAsStringLiteral(statuses).withDefault('all').withOptions({ history: 'replace' }),
  q: parseAsString.withDefault(''),
};
const serialize = createSerializer(parsers);
type View = {
  plugin: string;
  pluginSearch: string;
  pluginTag: string[];
  pluginStatus: PluginStatus;
  q: string;
};

type PluginEntry = {
  id: string;
  enabled: boolean;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  homepage?: string;
  support?: string;
  cover?: string;
  icon: IconComponent;
  tags: readonly string[];
};
/** Installed plugins with their metadata; `plugins.<id>.name|description` translate it. */
function usePlugins(): readonly PluginEntry[] {
  const { runtime } = useBitaKit();
  const t = useTranslation();
  const inventory = useRuntimeInventory();
  return useMemo(() => {
    const appId = runtime.config.appId ?? 'app';
    return inventory.static.plugins
      .filter((module) => module.id !== appId)
      .map((module) => {
        const meta = module.metadata;
        return {
          id: module.id,
          enabled:
            module.enabled === true &&
            inventory.live?.plugins.find((entry) => entry.id === module.id)?.phase !== 'failed',
          name: t(`plugins.${module.id}.name`, undefined, meta?.name ?? module.id),
          description:
            t(`plugins.${module.id}.description`, undefined, meta?.description ?? '') || undefined,
          version: meta?.version,
          tags: [...new Set(meta?.tags ?? [])],
          author: meta?.author,
          license: meta?.license,
          homepage: safeHref(meta?.homepage),
          support: safeHref(meta?.support),
          cover: safeHref(meta?.coverImage),
          icon:
            iconOf(
              runtime.config.plugins?.find((source) => source.id === module.id)?.metadata?.icon,
            ) ?? PuzzleIcon,
        };
      });
  }, [runtime, t, inventory]);
}

function PluginMedia({ plugin }: { plugin: PluginEntry }) {
  const Icon = plugin.icon;
  const [failedCover, setFailedCover] = useState<string>();
  return plugin.cover && failedCover !== plugin.cover ? (
    <ItemMedia variant="image">
      <img src={plugin.cover} alt="" onError={() => setFailedCover(plugin.cover)} />
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
  const sections = visibleSections(useSettingsCatalog()).filter(
    (entry) => entry.plugin === plugin.id,
  );
  const { Link } = location;
  return (
    <section
      aria-labelledby={`${id}title`}
      className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-6"
    >
      <PageHeader
        before={back}
        titleId={`${id}title`}
        title={plugin.name}
        subtitle={plugin.author ? messages('author', { author: plugin.author }) : undefined}
        trailing={plugin.version && <Badge variant="secondary">{plugin.version}</Badge>}
      />
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="grid min-w-0 gap-6 p-2 lg:grid-cols-3">
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
              {sections.length ? (
                sections.map((section) =>
                  section.component ? (
                    <Item key={section.id} asChild variant="outline">
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
                    <SettingsFields key={section.id} section={section} />
                  ) : null,
                )
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
      </ScrollArea>
    </section>
  );
}

function PluginsView({
  view,
  onSearch,
  onTag,
  onClearTags,
  onStatus,
}: {
  view: View;
  onSearch?: (value: string | null) => void;
  onTag?: (tag: string, checked: boolean) => void;
  onClearTags?: () => void;
  onStatus?: (value: PluginStatus) => void;
}) {
  const messages = useMessages();
  const statusLabels = {
    all: messages('allPlugins'),
    enabled: messages('enabledPlugins'),
    disabled: messages('disabledPlugins'),
  };
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
  const tags = [...new Set([...plugins.flatMap((plugin) => plugin.tags), ...view.pluginTag])].sort(
    (a, b) => a.localeCompare(b),
  );
  const terms = view.pluginSearch.trim().toLocaleLowerCase();
  const entries = plugins.filter(
    (plugin) =>
      `${plugin.name} ${plugin.description ?? ''} ${plugin.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(terms) &&
      (!view.pluginTag.length || view.pluginTag.some((tag) => plugin.tags.includes(tag))) &&
      (view.pluginStatus === 'all' || plugin.enabled === (view.pluginStatus === 'enabled')),
  );
  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4">
      <PageHeader title={own?.title ?? messages('plugins')} subtitle={own?.description} />
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-xs">
          <SearchField
            label={messages('searchPlugins')}
            placeholder={messages('searchPluginsPlaceholder')}
            clearLabel={messages('clearPluginSearch')}
            value={view.pluginSearch}
            onValueChange={onSearch}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label={messages('filterTags')}>
              {messages('tags')}
              {view.pluginTag.length > 0 && (
                <Badge variant="secondary">{view.pluginTag.length}</Badge>
              )}
              <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {tags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag}
                checked={view.pluginTag.includes(tag)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => onTag?.(tag, checked === true)}
              >
                {tag}
              </DropdownMenuCheckboxItem>
            ))}
            {tags.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem disabled={!view.pluginTag.length} onSelect={onClearTags}>
              {messages('clearTags')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label={messages('filterStatus')}>
              {statusLabels[view.pluginStatus]}
              <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={view.pluginStatus}
              onValueChange={(value) => onStatus?.(value as PluginStatus)}
            >
              {statuses.map((status) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {statusLabels[status]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <PluginChangeFeedback />
      <ScrollArea
        key={`${view.pluginSearch}:${view.pluginTag.join()}:${view.pluginStatus}`}
        className="-mx-1 min-h-0 min-w-0 flex-initial"
      >
        <div className="py-1 ps-1 pe-4">
          {entries.length > 0 && (
            <Card size="sm" className="py-0">
              <ItemGroup
                className="app-preferences-plugins gap-0 has-data-[size=sm]:gap-0"
                aria-label={messages('plugins')}
              >
                {entries.map((plugin, index) => (
                  <Fragment key={plugin.id}>
                    <div role="listitem" className="flex min-w-0 items-center">
                      <Item
                        asChild
                        size="sm"
                        className="app-preferences-plugin min-w-0 flex-1 flex-nowrap [a]:hover:bg-transparent"
                      >
                        <Link href={href(plugin.id)}>
                          <PluginMedia plugin={plugin} />
                          <ItemContent className="min-w-0">
                            <ItemTitle className="max-w-full flex-wrap overflow-visible">
                              <span className="min-w-0 wrap-anywhere">{plugin.name}</span>
                              {plugin.version && (
                                <Badge
                                  variant="secondary"
                                  className="max-w-full whitespace-normal wrap-anywhere"
                                >
                                  {plugin.version}
                                </Badge>
                              )}
                            </ItemTitle>
                            {plugin.description && (
                              <ItemDescription className="line-clamp-none wrap-anywhere">
                                {plugin.description}
                              </ItemDescription>
                            )}
                            {plugin.author && (
                              <ItemDescription className="line-clamp-none wrap-anywhere">
                                {messages('author', { author: plugin.author })}
                              </ItemDescription>
                            )}
                            {plugin.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {plugin.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className="max-w-full whitespace-normal wrap-anywhere"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </ItemContent>
                        </Link>
                      </Item>
                      <PluginToggle id={plugin.id} name={plugin.name} />
                    </div>
                    {index < entries.length - 1 && <ItemSeparator className="my-0" />}
                  </Fragment>
                ))}
              </ItemGroup>
            </Card>
          )}
          {!entries.length && (
            <Empty role="status">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{messages('noPlugins')}</EmptyTitle>
                <EmptyDescription>{messages('noPluginsHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
function SearchablePlugins() {
  const [view, setView] = useQueryStates(parsers);
  return (
    <PluginsView
      view={view}
      onSearch={(value) => void setView({ pluginSearch: value })}
      onTag={(tag, checked) =>
        void setView((current) => ({
          pluginTag: checked
            ? [...new Set([...current.pluginTag, tag])]
            : current.pluginTag.filter((value) => value !== tag),
        }))
      }
      onClearTags={() => void setView({ pluginTag: [] })}
      onStatus={(value) => void setView({ pluginStatus: value })}
    />
  );
}

/**
 * The plugin overview: installed plugins with their metadata, searchable, and one plugin's
 * details with its settings when `?plugin=<id>` is set. App Preferences' own settings page.
 */
export function PluginsOverview() {
  return (
    <Suspense
      fallback={
        <PluginsView
          view={{
            plugin: '',
            pluginSearch: '',
            pluginTag: [],
            pluginStatus: 'all',
            q: '',
          }}
        />
      }
    >
      <SearchablePlugins />
    </Suspense>
  );
}
