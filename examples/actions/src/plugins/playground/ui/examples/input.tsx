'use client';
import { useState } from 'react';
import { Action } from '@bitakit/ui';
import { Button, Input } from '@bitakit/ui/components';

// The schema in actions/greet.ts keeps the button disabled until the name is valid.
export function InputExample() {
  const [name, setName] = useState('');
  return (
    <form className="flex max-w-md gap-2" onSubmit={(event) => event.preventDefault()}>
      <Input
        value={name}
        aria-label="Your name"
        placeholder="Your name"
        onChange={(event) => setName(event.target.value)}
      />
      <Action id="playground.greet" input={name}>
        <Button type="submit" />
      </Action>
    </form>
  );
}
