'use client';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  useBitaKit,
  useGroupTitle,
  useService,
  useServiceState,
  useSetting,
  useTranslation,
} from '@bitakit/ui';
import { useActions, useActionList, ActionShortcutLabel } from '@bitakit/ui/actions';
import { Button } from '@bitakit/ui/components';
import { safeHref } from '@bitakit/core';
import { Command, defaultFilter } from 'cmdk';
import SearchIcon from 'reicon-react/icons/Search';
import XIcon from 'reicon-react/icons/Xmark';
import { emptySearch, sourceEnabled, availableResult, type SearchRequest } from '../service.js';
import { useSources, useSearchText } from './use-sources.js';
import { SourcePreferences } from './source-preferences.js';
import { SearchControls } from './search-controls.js';
import { ResultItem, type ResultRow } from './search-result.js';

export function SearchResults({
  close,
  label,
  placeholder,
  empty,
}: {
  close(): void;
  label: string;
  placeholder: string;
  empty: string;
}) {
  const t = useTranslation();
  const text = useSearchText();
  const groupTitle = useGroupTitle();
  const { runtime } = useBitaKit();
  const sources = useSources();
  const preferences = useSetting('quick-search.sources');
  const history = useSetting('quick-search.history');
  const historyEnabled = useSetting('quick-search.historyEnabled');
  const service = useService('quick-search.search');
  const state = useServiceState('quick-search.search', undefined, emptySearch);
  const [showSources, setShowSources] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const actions = useActions();
  const list = useActionList();
  // A service result publication refreshes Actions too. Compare their actual search fields so
  // that publication cannot restart its own request; changed navigation still re-runs immediately.
  const actionVersion = JSON.stringify(
    Object.keys(actions).flatMap((id) => {
      const action = list.resolve(id);
      return action?.href
        ? [
            [
              id,
              action.title,
              action.description,
              action.href,
              action.visible,
              action.enabled,
              action.pending,
              action.order,
              action.shortcut?.keys,
              action.groups?.map((group) => [group.id, groupTitle(group)]),
              runtime.destinationOf(action),
            ],
          ]
        : [];
    }),
  );
  const identity = runtime.settings.currentIdentity;
  const request = useMemo<SearchRequest>(
    () => ({
      query,
      category,
      sources,
      identity,
      environment: { runtime, actions: list, text, groupTitle, score: defaultFilter },
    }),
    [
      query,
      category,
      sources,
      identity,
      runtime,
      list,
      text,
      groupTitle,
      actionVersion,
      preferences.value,
      preferences.ready,
      history.value,
      history.ready,
      historyEnabled.value,
      historyEnabled.ready,
    ],
  );
  useEffect(() => service?.search(request), [service, request]);
  const enabledSources = sources.filter((source) => sourceEnabled(source, preferences.value));
  useEffect(() => {
    if (category && !enabledSources.some((source) => source.source.category.id === category))
      setCategory(null);
  }, [category, sources, preferences.value]);
  // Event-time checks also cover removal/preferences changing before React commits a new view.
  const current = (row: ResultRow) => {
    const source = runtime.slots
      .get('quick-search.sources')
      .items.find((item) => item.id === row.sourceId);
    const registered = request.sources.find((item) => item.id === row.sourceId);
    if (
      !source ||
      !registered ||
      source.data !== registered.source ||
      !runtime.isReady(source.plugin) ||
      !runtime.isReady('quick-search') ||
      runtime.settings.currentIdentity !== request.identity ||
      service?.state.get().request !== request ||
      !runtime.settings.state('quick-search.sources').ready ||
      !sourceEnabled(registered, runtime.settings.get('quick-search.sources'))
    )
      return false;
    const result = availableResult(row.result, request.environment);
    if (!result) return false;
    const action = 'actionId' in result ? list.resolve(result.actionId) : undefined;
    return !action || (action.enabled && !action.pending);
  };
  const found = state.request === request && preferences.ready ? state.sources : [];
  const rows: ResultRow[] = [];
  const seen = new Set<string>();
  // Recent references are freshly resolved. Ready results remain visible while another source loads.
  for (const recent of [true, false])
    for (const entry of found) {
      for (const candidate of recent ? entry.recent : entry.results) {
        const result = availableResult(candidate, request.environment);
        if (!result) continue;
        const action = 'actionId' in result ? list.resolve(result.actionId) : undefined;
        const href = safeHref('href' in result ? result.href : action?.href);
        if (!href || seen.has(href)) continue;
        seen.add(href);
        rows.push({ sourceId: entry.source.id, result, recent });
      }
    }
  const remember = (row: ResultRow) => {
    if (!current(row)) return;
    void service?.remember(request, row.sourceId, row.result).catch(() => setHistoryFailed(true));
  };
  const openInNewTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      showSources ||
      event.key !== 'Enter' ||
      !(event.metaKey || event.ctrlKey) ||
      event.nativeEvent.isComposing
    )
      return;
    const link = event.currentTarget.querySelector<HTMLAnchorElement>(
      '[cmdk-item][data-selected="true"] a[href]',
    );
    if (!link) return;
    event.preventDefault();
    const row = rows.find(
      (row) => row.sourceId === link.dataset.source && row.result.id === link.dataset.result,
    );
    if (!row || !current(row)) return;
    const valid = availableResult(row.result, request.environment);
    if (!valid) return;
    const action = 'actionId' in valid ? list.resolve(valid.actionId) : undefined;
    if (action && (!action.enabled || action.pending)) return;
    const href = safeHref('href' in valid ? valid.href : action?.href);
    if (!href) return;
    remember(row);
    window.open(new URL(href, window.location.href).href, '_blank', 'noopener');
  };
  const groups = new Map<string, { title: string | undefined; rows: ResultRow[] }>();
  for (const row of rows) {
    const action = 'actionId' in row.result ? list.resolve(row.result.actionId) : undefined;
    const group = action?.groups?.[0];
    const source = sources.find((item) => item.id === row.sourceId)!;
    const key = row.recent ? 'recent' : `${row.sourceId}:${group?.id ?? ''}`;
    const title = row.recent
      ? t('quickSearch.recentResults', undefined, 'Recently opened')
      : group
        ? groupTitle(group)
        : text(source.source.title);
    if (!groups.has(key)) groups.set(key, { title, rows: [] });
    groups.get(key)!.rows.push(row);
  }
  const recentQueries =
    !query.trim() && !category && history.ready && historyEnabled.value
      ? history.value.queries.filter(
          (item) => item.organizationId === (identity.organizationId ?? null),
        )
      : [];
  const loading =
    !preferences.ready ||
    found.some((source) => source.status === 'loading' || source.recentStatus === 'loading');
  label = t(label, undefined, t('quickSearch.title', undefined, label));
  placeholder =
    placeholder === 'Search…'
      ? t('quickSearch.placeholder', undefined, placeholder)
      : t(placeholder, undefined, placeholder);
  empty =
    empty === 'No results found.'
      ? t('quickSearch.empty', undefined, empty)
      : t(empty, undefined, empty);
  const closeLabel = t('quickSearch.close', undefined, 'Close');
  return (
    <Command
      label={label}
      loop
      shouldFilter={false}
      className="quick-search"
      onKeyDown={openInNewTab}
    >
      <div className="quick-search-input">
        <SearchIcon aria-hidden="true" />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          aria-label={placeholder}
          className="quick-search-control"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={closeLabel}
          onClick={close}
          onKeyDown={(event: KeyboardEvent) => event.stopPropagation()}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <SearchControls
        sources={enabledSources}
        category={category}
        setCategory={setCategory}
        expanded={showSources}
        setExpanded={setShowSources}
      />
      {showSources && (
        <div
          className="quick-search-list p-2"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') event.stopPropagation();
          }}
        >
          <SourcePreferences />
        </div>
      )}
      <Command.List
        hidden={showSources}
        className="quick-search-list"
        aria-busy={!showSources && loading}
      >
        {!showSources && (
          <>
            {!preferences.ready && (
              <p role="status" className="quick-search-status quick-search-link">
                {preferences.error
                  ? t(
                      'quickSearch.preferencesError',
                      undefined,
                      'Could not load search preferences.',
                    )
                  : t('quickSearch.loading', undefined, 'Searching…')}
              </p>
            )}
            {!loading && !rows.length && !recentQueries.length && (
              <Command.Empty className="quick-search-empty">{empty}</Command.Empty>
            )}
            {!!recentQueries.length && (
              <Command.Group
                heading={t('quickSearch.recentQueries', undefined, 'Recent searches')}
                className="quick-search-group"
              >
                {recentQueries.map(({ query }) => (
                  <Command.Item
                    key={query}
                    value={`query:${query}`}
                    onSelect={() => setQuery(query)}
                    className="quick-search-item"
                  >
                    <span className="quick-search-link">{query}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {[...groups].map(([key, group]) => (
              <Command.Group key={key} heading={group.title} className="quick-search-group">
                {group.rows.map((row) => (
                  <ResultItem
                    key={JSON.stringify([row.sourceId, row.result.id])}
                    row={row}
                    close={close}
                    remember={remember}
                    current={current}
                  />
                ))}
              </Command.Group>
            ))}
            {found.map(
              (entry) =>
                (entry.status !== 'ready' || entry.recentStatus !== 'ready') && (
                  <div key={entry.source.id} role="status" className="quick-search-link">
                    {text(entry.source.source.title)}:{' '}
                    {entry.status === 'error' || entry.recentStatus === 'error'
                      ? t('quickSearch.sourceError', undefined, 'Could not load results.')
                      : t('quickSearch.loading', undefined, 'Searching…')}
                    {(entry.status === 'error' || entry.recentStatus === 'error') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => service?.search(request)}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {t('quickSearch.retry', undefined, 'Retry')}
                      </Button>
                    )}
                  </div>
                ),
            )}
            {(historyFailed || history.error) && (
              <p role="status" className="quick-search-link">
                {t(
                  'quickSearch.historyError',
                  undefined,
                  'Could not update search history. Try again.',
                )}
              </p>
            )}
          </>
        )}
      </Command.List>
      <div className="quick-search-footer">
        <span className="quick-search-hints">
          <Hint keys={['Enter']} label={t('quickSearch.hints.open', undefined, 'Open')} />
          <Hint keys={['Mod+Enter']} label={t('quickSearch.hints.newTab', undefined, 'New tab')} />
        </span>
        <span className="quick-search-hints">
          <Hint
            keys={['ArrowUp', 'ArrowDown']}
            label={t('quickSearch.hints.navigate', undefined, 'Navigate')}
          />
          <Hint keys={['Escape']} label={closeLabel} />
        </span>
      </div>
    </Command>
  );
}
function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="quick-search-hint">
      {keys.map((key) => (
        <kbd key={key} className="quick-search-key">
          <ActionShortcutLabel keys={key} />
        </kbd>
      ))}
      {label}
    </span>
  );
}
