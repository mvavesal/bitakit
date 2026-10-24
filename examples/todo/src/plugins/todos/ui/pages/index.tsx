'use client';
import { useState } from 'react';
import { Action, useServiceState } from '@bitakit/ui';
import { Button, Input, PageHeader } from '@bitakit/ui/components';

export default function TodosPage() {
  const [title, setTitle] = useState('');
  const todos = useServiceState('todos.list', (state) => state.todos, []);
  const left = todos.filter((todo) => !todo.done).length;
  return (
    <>
      <PageHeader title="Todos" subtitle={`${left} of ${todos.length} left`} />
      <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={title}
          aria-label="New todo"
          placeholder="What needs doing?"
          onChange={(event) => setTitle(event.target.value)}
        />
        {/* Clear the field only when the todo was added. */}
        <Action
          id="todos.add"
          input={title}
          onExecuted={(result) => result.status === 'completed' && setTitle('')}
        >
          <Button type="submit" />
        </Action>
      </form>
      <ul className="flex flex-col gap-2">
        {todos.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2">
            <span className={todo.done ? 'flex-1 line-through text-muted-foreground' : 'flex-1'}>
              {todo.title}
            </span>
            <Action id="todos.toggle" input={todo.id}>
              <Button variant="outline" size="sm" />
            </Action>
            <Action id="todos.remove" input={todo.id}>
              <Button variant="ghost" size="sm" />
            </Action>
          </li>
        ))}
      </ul>
      <Action id="todos.clear-done">
        <Button variant="outline" />
      </Action>
    </>
  );
}
