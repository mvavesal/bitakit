'use client';
import { Action } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

// `success` and `failure` word the message after a run; the buttons only bind the Actions.
export function MessagesExample() {
  return (
    <div className="flex flex-wrap gap-2">
      <Action id="playground.hello">
        <Button />
      </Action>
      <Action id="playground.fail">
        <Button variant="outline" />
      </Action>
    </div>
  );
}
