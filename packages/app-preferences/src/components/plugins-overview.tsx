'use client';
import { Suspense, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  createSerializer,
  parseAsNativeArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@bitakit/ui/components';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
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
import { ScrollArea } from './ui/scroll-area.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table.js';

import { useMessages } from './use-messages.js';

const parsers = {
  plugin: parseAsString.withDefault('').withOptions({ history: 'push' }),
  pluginSearch: parseAsString.withDefault('').withOptions({ history: 'replace' }),
  pluginTag: parseAsNativeArrayOf(parseAsString).withOptions({ history: 'replace' }),
  pluginPage: parseAsInteger.withDefault(1).withOptions({ history: 'replace' }),
  pluginPageSize: parseAsNumberLiteral([5, 10, 20, 50] as const)
    .withDefault(10)
    .withOptions({ history: 'replace' }),
  q: parseAsString.withDefault(''),
};
const serialize = createSerializer(parsers);
type View = {
  plugin: string;
  pluginSearch: string;
  pluginTag: string[];
  pluginPage: number;
  pluginPageSize: 5 | 10 | 20 | 50;
  q: string;
};

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
            iconOf(runtime.modules.find((source) => source.id === module.id)?.metadata?.icon) ??
            PuzzleIcon,
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

function PluginPagination({
  view,
  total,
  onPage,
  onPageSize,
}: {
  view: View;
  total: number;
  onPage?: (page: number) => void;
  onPageSize?: (size: View['pluginPageSize']) => void;
}) {
  const messages = useMessages();
  const pages = Math.max(1, Math.ceil(total / view.pluginPageSize));
  const page = Math.min(pages, Math.max(1, view.pluginPage));
  useEffect(() => {
    if (page !== view.pluginPage) onPage?.(page);
  }, [page, view.pluginPage, onPage]);
  return (
    <nav
      aria-label={messages('pagination')}
      className="flex shrink-0 flex-wrap items-center justify-between gap-3"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label={messages('perPage')}>
            {messages('perPage')}: {view.pluginPageSize}
            <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup
            value={String(view.pluginPageSize)}
            onValueChange={(value) => onPageSize?.(Number(value) as View['pluginPageSize'])}
          >
            {([5, 10, 20, 50] as const).map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)}>
                {size}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-sm" aria-live="polite">
        {messages('pageSummary', { total, page, pages })}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage?.(page - 1)}>
          {messages('previousPage')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage?.(page + 1)}
        >
          {messages('nextPage')}
        </Button>
      </div>
    </nav>
  );
}

function PluginsView({
  view,
  onSearch,
  onTag,
  onClearTags,
  onPage,
  onPageSize,
}: {
  view: View;
  onSearch?: (value: string | null) => void;
  onTag?: (tag: string, checked: boolean) => void;
  onClearTags?: () => void;
  onPage?: (page: number) => void;
  onPageSize?: (size: View['pluginPageSize']) => void;
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
  const tags = [...new Set([...plugins.flatMap((plugin) => plugin.tags), ...view.pluginTag])].sort(
    (a, b) => a.localeCompare(b),
  );
  const terms = view.pluginSearch.trim().toLocaleLowerCase();
  const entries = plugins.filter(
    (plugin) =>
      `${plugin.name} ${plugin.description ?? ''} ${plugin.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(terms) &&
      (!view.pluginTag.length || view.pluginTag.some((tag) => plugin.tags.includes(tag))),
  );
  const page = Math.min(
    Math.max(1, Math.ceil(entries.length / view.pluginPageSize)),
    Math.max(1, view.pluginPage),
  );
  const pageEntries = entries.slice((page - 1) * view.pluginPageSize, page * view.pluginPageSize);
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
      </div>
      <ScrollArea
        key={`${view.pluginPage}:${view.pluginPageSize}:${view.pluginSearch}:${view.pluginTag.join()}`}
        className="-mx-1 min-h-0 min-w-0 flex-initial"
      >
        <div className="px-1 py-2">
          <Table aria-label={messages('plugins')}>
            <TableHeader>
              <TableRow>
                <TableHead>{messages('pluginName')}</TableHead>
                <TableHead>{messages('version')}</TableHead>
                <TableHead>{messages('tags')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageEntries.map((plugin) => (
                <TableRow key={plugin.id}>
                  <TableCell className="min-w-64 whitespace-normal">
                    <Link href={href(plugin.id)} className="flex items-center gap-3">
                      <PluginMedia plugin={plugin} />
                      <span className="flex min-w-0 flex-col gap-1 wrap-anywhere">
                        <span className="font-medium">{plugin.name}</span>
                        {plugin.description && (
                          <span className="text-muted-foreground">{plugin.description}</span>
                        )}
                        {plugin.author && (
                          <span className="text-muted-foreground">
                            {messages('author', { author: plugin.author })}
                          </span>
                        )}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {plugin.version ? (
                      <Badge variant="secondary">{plugin.version}</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{messages('unspecified')}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1.5">
                      {plugin.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!entries.length && (
            <Empty role="status">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PuzzleIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{messages('noPlugins')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
      <PluginPagination
        view={view}
        total={entries.length}
        onPage={onPage}
        onPageSize={onPageSize}
      />
    </div>
  );
}
function SearchablePlugins() {
  const [view, setView] = useQueryStates(parsers);
  return (
    <PluginsView
      view={view}
      onSearch={(value) => void setView({ pluginSearch: value, pluginPage: 1 })}
      onTag={(tag, checked) =>
        void setView((current) => ({
          pluginPage: 1,
          pluginTag: checked
            ? [...new Set([...current.pluginTag, tag])]
            : current.pluginTag.filter((value) => value !== tag),
        }))
      }
      onClearTags={() => void setView({ pluginTag: [], pluginPage: 1 })}
      onPage={(pluginPage) => void setView({ pluginPage })}
      onPageSize={(pluginPageSize) => void setView({ pluginPageSize, pluginPage: 1 })}
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
            pluginPage: 1,
            pluginPageSize: 10,
            q: '',
          }}
        />
      }
    >
      <SearchablePlugins />
    </Suspense>
  );
}
