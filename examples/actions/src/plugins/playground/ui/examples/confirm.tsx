'use client';
import { Action } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

// `confirm` asks before the run; `dialog` opens a component instead of running `execute`.
export function ConfirmExample() {
  return (
    <div className="flex flex-wrap gap-2">
      <Action id="playground.reset">
        <Button variant="destructive" />
      </Action>
      <Action id="playground.details">
        <Button variant="outline" />
      </Action>
    </div>
  );
}
