'use client';
import { useRef, type MouseEvent } from 'react';
import { Command } from 'cmdk';
import { safeHref } from '@bitakit/core';
import { useAction, useBitaKitNavigation, useSetting } from '@bitakit/ui';
import { ActionLink, ActionShortcutLabel } from '@bitakit/ui/actions';
import LinkIcon from 'reicon-react/icons/Link';
import type { SearchResult } from '../types.js';

export type ResultRow = { sourceId: string; result: SearchResult; recent?: boolean };
type ResultProps = {
  row: ResultRow;
  close(): void;
  remember(row: ResultRow): void;
  current(row: ResultRow): boolean;
};
export function ResultItem(props: ResultProps) {
  return 'actionId' in props.row.result ? (
    <ActionResultItem {...props} actionId={props.row.result.actionId} />
  ) : (
    <ResultContent {...props} />
  );
}
function ActionResultItem(props: ResultProps & { actionId: string }) {
  const action = useAction(props.actionId);
  return <ResultContent {...props} action={action} />;
}
function ResultContent({
  row,
  close,
  remember,
  current,
  action,
}: ResultProps & { action?: ReturnType<typeof useAction> }) {
  const link = useRef<HTMLAnchorElement>(null);
  const { Link = 'a' } = useBitaKitNavigation();
  const showSource = useSetting('quick-search.showSource');
  const result = row.result;
  const isAction = 'actionId' in result;
  if (isAction && (!action?.visible || !safeHref(action.href))) return null;
  const href = isAction ? action?.href : safeHref(result.href);
  if (!href) return null;
  const title = isAction ? action!.title : result.title;
  const description = isAction ? action?.description : result.description;
  const detail = showSource.value && isAction ? result.detail : undefined;
  const Icon = action?.icon ?? LinkIcon;
  const disabled = isAction && (!action?.enabled || action?.pending);
  const value = isAction ? result.actionId : JSON.stringify([row.sourceId, result.id]);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (!current(row) || disabled) {
      event.preventDefault();
      return;
    }
    if (event.defaultPrevented) return;
    remember(row);
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
      close();
  };
  const children = (
    <>
      <Icon aria-hidden="true" />
      <span className="quick-search-text">
        <span className="quick-search-title">{title}</span>
        {description && <span className="quick-search-description">{description}</span>}
      </span>
      {(detail || action?.shortcut) && (
        <span className="quick-search-meta">
          {action?.shortcut && (
            <span className="quick-search-shortcut">
              <ActionShortcutLabel keys={action.shortcut.keys} />
            </span>
          )}
          {detail && <span className="quick-search-kind">{detail}</span>}
        </span>
      )}
    </>
  );
  const props = {
    ref: link,
    tabIndex: -1,
    className: 'quick-search-link',
    onClick,
    onAuxClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button === 1) onClick(event);
    },
    'data-source': row.sourceId,
    'data-result': result.id,
  };
  return (
    <Command.Item
      value={value}
      disabled={disabled}
      onSelect={() => link.current?.click()}
      className="quick-search-item"
    >
      {isAction ? (
        <ActionLink action={result.actionId} {...props}>
          {children}
        </ActionLink>
      ) : (
        <Link href={href} {...props}>
          {children}
        </Link>
      )}
    </Command.Item>
  );
}
