'use client';
import { useState } from 'react';
import { Action, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@bitakit/ui/components';

const rows = ['Apple', 'Banana', 'Cherry'];

// Three ways to run while busy: `exclusive` (the default) skips a second click, `per-input`
// keeps one pending state per row, `latest` drops the runs a newer one overtook.
export function RunningExample() {
  const [query, setQuery] = useState('');
  const liked = useServiceState('playground.demo', (state) => state.liked, []);
  const results = useServiceState('playground.demo', (state) => state.results, []);
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Pending: exclusive</FieldLabel>
        <div>
          <Action id="playground.slow" pending="…">
            <Button />
          </Action>
        </div>
      </Field>
      <Field>
        <FieldLabel>One pending state per row: per-input</FieldLabel>
        <ItemGroup className="max-w-md">
          {rows.map((row) => (
            <Item key={row} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  {row} {liked.includes(row) && <Badge variant="secondary">Liked</Badge>}
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <Action id="playground.like" input={row}>
                  <Button variant="outline" size="sm" />
                </Action>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </Field>
      <Field className="max-w-md">
        <FieldLabel htmlFor="search-fruit">Only the last run counts: latest</FieldLabel>
        {/* Runs on every keystroke; the Action drops the searches that were overtaken. */}
        <Action id="playground.search" input={query}>
          {(control) => (
            <Input
              id="search-fruit"
              value={query}
              placeholder="Search fruit"
              aria-busy={control.pending}
              onChange={(event) => {
                setQuery(event.target.value);
                void control.execute(event.target.value);
              }}
            />
          )}
        </Action>
        <FieldDescription>
          {results.length ? results.join(', ') : 'No fruit matches.'}
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
