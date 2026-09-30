'use client';
import { useTranslation } from '@bitakit/ui';
import { useRef } from 'react';
import LinkIcon from 'reicon-react/icons/Link';
import { safeHref } from '@bitakit/core';
import { useActions, useActionList, ActionLink, ActionShortcutLabel } from '@bitakit/ui/actions';
import { Input } from '@bitakit/ui/components';
import { Command } from 'cmdk';
import type { ActionSnapshot } from '@bitakit/core';

/** Read current resolved snapshots; cmdk owns filtering, ranking and keyboard selection. */
export function SearchResults({ close, label, placeholder, empty }: {
  close(): void; label: string; placeholder: string; empty: string;
}) {
  const t = useTranslation();
  label = t(label, undefined, t('quickSearch.title', undefined, label));
  placeholder = t(placeholder, undefined, placeholder === 'Seiten suchen …' ? t('quickSearch.placeholder', undefined, placeholder) : placeholder);
  empty = t(empty, undefined, empty === 'Keine Ergebnisse gefunden.' ? t('quickSearch.empty', undefined, empty) : empty);
  const snapshots = useActions();
  const list = useActionList();
  const groups = new Map<string, { title?: string; items: ActionSnapshot[] }>();
  const destinations = new Map<string, ActionSnapshot>();
  for (const snapshot of Object.values(snapshots)) {
    const action = list.resolve(snapshot.id);
    const href = action && safeHref(action.href);
    if (!action?.visible || !href) continue;
    const existing = destinations.get(href);
    // One destination may have both a catalog projection and an explicit shortcut Action.
    if (!existing || (!existing.shortcut && action.shortcut)) destinations.set(href, action);
  }
  for (const action of [...destinations.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const group = action.groups?.[0];
    const key = group?.id ?? '';
    if (!groups.has(key)) groups.set(key, { title: group?.title ?? group?.id, items: [] });
    groups.get(key)!.items.push(action);
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
            {group.items.map(action => <SearchResult key={action.id} action={action} close={close} />)}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  );
}

function SearchResult({ action, close }: { action: ActionSnapshot; close(): void }) {
  const link = useRef<HTMLAnchorElement>(null);
  const Icon = action.icon ?? LinkIcon;
  return (
    <Command.Item value={action.id} disabled={!action.enabled || action.pending}
      keywords={[action.title, action.description ?? '', ...(action.groups ?? []).map(g => g.title ?? g.id)]}
      onSelect={() => link.current?.click()} className="quick-search-item">
      <ActionLink action={action.id} ref={link} tabIndex={-1} className="quick-search-link"
        onClick={(event) => {
          event.stopPropagation();
          if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) close();
        }}>
        {Icon && <Icon aria-hidden="true" />}
        <span className="quick-search-text">
          <span>{action.title}</span>
          {action.description && <span className="quick-search-description">{action.description}</span>}
        </span>
        {action.shortcut && <span className="quick-search-shortcut"><ActionShortcutLabel keys={action.shortcut.keys} /></span>}
      </ActionLink>
    </Command.Item>
  );
}
