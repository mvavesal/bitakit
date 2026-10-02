'use client';
import { useFoundation, useGroupTitle, useTranslation } from '@bitakit/ui';
import { useRef } from 'react';
import LinkIcon from 'reicon-react/icons/Link';
import { safeHref } from '@bitakit/core';
import { useActions, useActionList, ActionLink, ActionShortcutLabel } from '@bitakit/ui/actions';
import { Input } from '@bitakit/ui/components';
import { Command } from 'cmdk';
import type { ActionSnapshot, Destination, DestinationKind } from '@bitakit/core';

/** Destination types to include. Omitted types keep their defaults: pages and settings on. */
export type QuickSearchResults = {
  /** Links to pages of the app and other navigation links. Default: true. */
  pages?: boolean;
  /** Pages of the Settings catalog. Default: true. */
  settings?: boolean;
  /** Plugins, linked to their view in Shell's plugin overview (`pluginManagement`). Default: false. */
  plugins?: boolean;
};
const defaults: Required<QuickSearchResults> = { pages: true, settings: true, plugins: false };
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
  const { runtime } = useFoundation();
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
    <Command label={label} loop className="quick-search">
      <Command.Input asChild autoFocus placeholder={placeholder} aria-label={placeholder}>
        <Input />
      </Command.Input>
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
    </Command>
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
          <span>{action.title}</span>
          {action.description && (
            <span className="quick-search-description">{action.description}</span>
          )}
        </span>
        {kind && <span className="quick-search-kind">{kind}</span>}
        {action.shortcut && (
          <span className="quick-search-shortcut">
            <ActionShortcutLabel keys={action.shortcut.keys} />
          </span>
        )}
      </ActionLink>
    </Command.Item>
  );
}
