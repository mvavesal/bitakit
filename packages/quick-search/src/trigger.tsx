'use client';
import { ActionButton, ActionShortcutLabel, useAction } from '@bitakit/ui/actions';
import { Button } from '@bitakit/ui/components';
import SearchIcon from 'reicon-react/icons/Search';
import { quickSearchActionId } from './constants.js';

/** A native action button using the central input surface, never a second text input. */
export function QuickSearchTrigger({ className }: { className?: string }) {
  const action = useAction(quickSearchActionId);
  return (
    <ActionButton
      action={quickSearchActionId}
      as={Button}
      variant="outline"
      data-slot="input"
      className={[
        'quick-search-trigger rounded-md border-input bg-transparent hover:bg-(--control-surface) dark:hover:bg-(--control-surface)',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-haspopup="dialog"
    >
      <SearchIcon aria-hidden="true" className="text-muted-foreground" />
      <span className="quick-search-trigger-label">{action?.title}</span>
      {action?.shortcut && (
        <kbd className="quick-search-shortcut quick-search-key">
          <ActionShortcutLabel keys={action.shortcut.keys} />
        </kbd>
      )}
    </ActionButton>
  );
}
