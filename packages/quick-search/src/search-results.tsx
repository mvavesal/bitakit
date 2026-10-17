'use client';
import { useBitaKit, useGroupTitle, useTranslation } from '@bitakit/ui';
import { useRef, type KeyboardEvent } from 'react';
import LinkIcon from 'reicon-react/icons/Link';
import SearchIcon from 'reicon-react/icons/Search';
import XIcon from 'reicon-react/icons/Xmark';
import { safeHref } from '@bitakit/core';
import { useActions, useActionList, ActionLink, ActionShortcutLabel } from '@bitakit/ui/actions';
import { Button } from '@bitakit/ui/components';
import { Command } from 'cmdk';
import type { ActionSnapshot, Destination, DestinationKind } from '@bitakit/core';

/** Destination types to include. Omitted types keep their defaults: pages, settings and plugins on. */
export type QuickSearchResults = {
  /** Links to pages of the app and other navigation links. Default: true. */
  pages?: boolean;
  /** Pages of the Settings catalog. Default: true. */
  settings?: boolean;
  /** Plugins, linked to their entry on the Plugins settings page of App Preferences. Default: true. */
  plugins?: boolean;
};
const defaults: Required<QuickSearchResults> = { pages: true, settings: true, plugins: true };
const kinds: Record<DestinationKind, string> = {
  plugin: 'Plugin',
  page: 'Page',
  settings: 'Settings',
};
/** The switch that includes a destination of this kind; external links count as pages. */
const switches: Record<DestinationKind, keyof QuickSearchResults> = {
  plugin: 'plugins',
  page: 'pages',
  settings: 'settings',
};
/** A projected kind (settings, plugin) describes a shared destination better than a page. */
const better = (current?: Destination, next?: Destination) =>
  current && current.kind !== 'page' ? current : (next ?? current);
/** Mod+Enter opens the selected result in a new tab, like a modified click on its link. */
const openInNewTab = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing)
    return;
  const link = event.currentTarget.querySelector<HTMLAnchorElement>(
    '[cmdk-item][data-selected="true"] a[href]',
  );
  if (!link) return;
  // Prevented events skip cmdk's own Enter handling, which would navigate in this tab.
  event.preventDefault();
  window.open(link.href, '_blank', 'noopener');
};

/**
 * Navigation only: results are the current visible URL Actions, never commands, dialogs or forms.
 * cmdk owns filtering, ranking and keyboard selection.
 */
export function SearchResults({
  close,
  label,
  placeholder,
  empty,
  results,
}: {
  close(): void;
  label: string;
  placeholder: string;
  empty: string;
  results?: QuickSearchResults;
}) {
  const t = useTranslation();
  const groupTitle = useGroupTitle();
  const { runtime } = useBitaKit();
  label = t(label, undefined, t('quickSearch.title', undefined, label));
  placeholder = t(
    placeholder,
    undefined,
    placeholder === 'Search pages…'
      ? t('quickSearch.placeholder', undefined, placeholder)
      : placeholder,
  );
  empty = t(
    empty,
    undefined,
    empty === 'No results found.' ? t('quickSearch.empty', undefined, empty) : empty,
  );
  const closeLabel = t('quickSearch.close', undefined, 'Close');
  const include = { ...defaults, ...results };
  /** "Page · Todos": the result type and, unless the app owns it, the owning plugin's name. */
  const describe = (destination?: Destination) => {
    if (!destination) return undefined;
    const kind = t(`quickSearch.kinds.${destination.kind}`, undefined, kinds[destination.kind]);
    // A plugin result is its own owner: "Todos — Plugin".
    if (!destination.plugin || destination.kind === 'plugin') return kind;
    const plugin = runtime.modules.find((module) => module.id === destination.plugin);
    return `${kind} · ${t(`plugins.${destination.plugin}.name`, undefined, plugin?.metadata?.name ?? destination.plugin)}`;
  };
  const snapshots = useActions();
  const list = useActionList();
  const groups = new Map<
    string,
    { title?: string; items: { action: ActionSnapshot; kind?: string }[] }
  >();
  const destinations = new Map<string, { action: ActionSnapshot; destination?: Destination }>();
  for (const snapshot of Object.values(snapshots)) {
    const action = list.resolve(snapshot.id);
    const href = action && safeHref(action.href);
    if (!action?.visible || !href) continue;
    const existing = destinations.get(href);
    // One destination may have both a catalog projection and an explicit shortcut Action.
    destinations.set(href, {
      action:
        !existing || (!existing.action.shortcut && action.shortcut) ? action : existing.action,
      destination: better(existing?.destination, runtime.destinationOf(action)),
    });
  }
  for (const { action, destination } of [...destinations.values()]
    .filter(({ destination }) => include[switches[destination?.kind ?? 'page']])
    .sort((a, b) => (a.action.order ?? 0) - (b.action.order ?? 0))) {
    const group = action.groups?.[0];
    const key = group?.id ?? '';
    if (!groups.has(key))
      groups.set(key, { title: group ? groupTitle(group) : undefined, items: [] });
    groups.get(key)!.items.push({ action, kind: describe(destination) });
  }
  return (
    <Command label={label} loop className="quick-search" onKeyDown={openInNewTab}>
      <div className="quick-search-input">
        <SearchIcon aria-hidden="true" />
        <Command.Input
          autoFocus
          placeholder={placeholder}
          aria-label={placeholder}
          className="quick-search-control"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={closeLabel}
          onClick={close}
          // Keeps Enter and Space on the button instead of selecting the highlighted result.
          onKeyDown={(event: KeyboardEvent) => event.stopPropagation()}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <Command.List className="quick-search-list">
        <Command.Empty className="quick-search-empty">{empty}</Command.Empty>
        {[...groups].map(([id, group]) => (
          <Command.Group key={id} heading={group.title} className="quick-search-group">
            {group.items.map(({ action, kind }) => (
              <SearchResult key={action.id} action={action} kind={kind} close={close} />
            ))}
          </Command.Group>
        ))}
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

/** A keyboard hint in the footer, with platform key labels from the shared shortcut formatter. */
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

function SearchResult({
  action,
  kind,
  close,
}: {
  action: ActionSnapshot;
  kind?: string;
  close(): void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const groupTitle = useGroupTitle();
  const Icon = action.icon ?? LinkIcon;
  return (
    <Command.Item
      value={action.id}
      disabled={!action.enabled || action.pending}
      keywords={[
        action.title,
        action.description ?? '',
        kind ?? '',
        ...(action.groups ?? []).map((group) => groupTitle(group)),
      ]}
      onSelect={() => link.current?.click()}
      className="quick-search-item"
    >
      <ActionLink
        action={action.id}
        ref={link}
        tabIndex={-1}
        className="quick-search-link"
        onClick={(event) => {
          event.stopPropagation();
          if (
            !event.defaultPrevented &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          )
            close();
        }}
      >
        {Icon && <Icon aria-hidden="true" />}
        <span className="quick-search-text">
          <span className="quick-search-title">{action.title}</span>
          {action.description && (
            <span className="quick-search-description">{action.description}</span>
          )}
        </span>
        {(kind || action.shortcut) && (
          <span className="quick-search-meta">
            {action.shortcut && (
              <span className="quick-search-shortcut">
                <ActionShortcutLabel keys={action.shortcut.keys} />
              </span>
            )}
            {kind && <span className="quick-search-kind">{kind}</span>}
          </span>
        )}
      </ActionLink>
    </Command.Item>
  );
}
