'use client';
import { Action, useSlot, useTranslation } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

/** Standard Action controls in the trailing header area of either Shell layout. */
export function ShellToolbar() {
  const toolbar = useSlot('shell.toolbar');
  const t = useTranslation();
  if (toolbar.error) throw toolbar.error;
  if (!toolbar.items.length) return null;
  return (
    <div
      role="group"
      aria-label={t('shell.ui.toolbar', undefined, 'App actions')}
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      {toolbar.items.map((item) =>
        item.action.href !== undefined ? (
          <Button key={item.key} asChild>
            <Action id={item.action} kind="link">
              <a />
            </Action>
          </Button>
        ) : (
          <Action key={item.key} id={item.action}>
            <Button />
          </Action>
        ),
      )}
    </div>
  );
}
