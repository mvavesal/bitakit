'use client';
import { Action, ActionMenu, ActionShortcutLabel } from '@bitakit/ui';
import { Button, Field, FieldGroup, FieldLabel, buttonVariants } from '@bitakit/ui/components';

// A shortcut runs the Action from the keyboard, `href` makes it a link, `groups` fill a menu.
export function MoreExample() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Keyboard shortcut</FieldLabel>
        <div className="flex items-center gap-2">
          <Action id="playground.shortcut">
            <Button variant="outline" />
          </Action>
          <span className="text-sm text-muted-foreground">
            <ActionShortcutLabel keys="Mod+Shift+H" />
          </span>
        </div>
      </Field>
      <Field>
        <FieldLabel>Link</FieldLabel>
        <div>
          <Action id="playground.docs">
            <a className={buttonVariants({ variant: 'link' })} />
          </Action>
        </div>
      </Field>
      <Field>
        <FieldLabel>Menu of a group</FieldLabel>
        <div>
          <ActionMenu group="playground.more" label="More" />
        </div>
      </Field>
    </FieldGroup>
  );
}
