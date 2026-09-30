'use client';
import { ActionButton, ActionShortcutLabel, useAction } from '@bitakit/ui/actions';
import { Button } from '@bitakit/ui/components';
import { quickSearchActionId } from './constants.js';

/** A button with a search-field affordance, never a second text input. */
export function QuickSearchTrigger({ className }: { className?: string }) {
  const action = useAction(quickSearchActionId);
  return <ActionButton action={quickSearchActionId} as={Button} variant="outline"
    className={['quick-search-trigger', className].filter(Boolean).join(' ')} aria-haspopup="dialog">
    <span className="quick-search-trigger-label">{action?.title}</span>
    {action?.shortcut && <span className="quick-search-shortcut"><ActionShortcutLabel keys={action.shortcut.keys} /></span>}
  </ActionButton>;
}
