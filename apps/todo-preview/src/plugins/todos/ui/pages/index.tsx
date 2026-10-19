'use client';
import { useState } from 'react';
import { Action, useServiceState } from '@bitakit/ui';
import { Badge, Button, Input, PageHeader } from '@bitakit/ui/components';
import type { Item } from '../../services/items';

function Task({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  return (
    <li className="flex flex-wrap items-center gap-2">
      {editing ? (
        <>
          <Input
            aria-label="Task title"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Action
            id="todos.edit"
            input={{ id: item.id, title: draft }}
            onExecuted={() => setEditing(false)}
          >
            <Button size="sm" />
          </Action>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 break-words">{item.title}</span>
          {item.completed && <Badge>Completed</Badge>}
          <Action id="todos.complete" input={{ id: item.id, completed: !item.completed }}>
            <Button variant="outline" size="sm" />
          </Action>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(item.title);
              setEditing(true);
            }}
          >
            Edit
          </Button>
          <Action id="todos.remove" input={item.id}>
            <Button variant="ghost" size="sm" />
          </Action>
        </>
      )}
    </li>
  );
}

// Served at /todos; the path comes from this file's location under ui/pages.
export default function TodosPage() {
  const items = useServiceState('todos.items', (state) => state.items, []);
  const organizationId = useServiceState('todos.items', (state) => state.organizationId, '');
  const pending = useServiceState('todos.items', (state) => state.pending, false);
  const error = useServiceState('todos.items', (state) => state.error, '');
  const [title, setTitle] = useState('');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Todos"
        subtitle="Tasks belong to the selected organization. All preview data is temporary."
      />
      {!organizationId ? (
        <p>Select an organization above to see its tasks.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              value={title}
              placeholder="New task"
              aria-label="New task"
              onChange={(event) => setTitle(event.target.value)}
            />
            <Action id="todos.add" input={title} onExecuted={() => setTitle('')}>
              <Button />
            </Action>
          </div>
          {pending && <p role="status">Loading tasks…</p>}
          {error && <p role="alert">{error}</p>}
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <Task key={item.id} item={item} />
            ))}
          </ul>
          {!pending && !error && items.length === 0 && <p>No tasks yet.</p>}
          <Action id="todos.clear">
            <Button variant="outline" className="self-start" />
          </Action>
        </>
      )}
    </div>
  );
}
