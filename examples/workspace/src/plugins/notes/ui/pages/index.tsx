'use client';
import { useState } from 'react';
import { Action, PluginSlot, useServiceState, useSlot } from '@bitakit/ui';
import { Button, Input, PageHeader } from '@bitakit/ui/components';

/** Renders the Actions other plugins placed in `notes.toolbar`. */
function Toolbar() {
  const toolbar = useSlot('notes.toolbar');
  if (toolbar.error) throw toolbar.error;
  if (!toolbar.items.length) return null;
  return (
    <div role="group" aria-label="Note tools" className="flex flex-wrap gap-2">
      {toolbar.items.map((item) => (
        <Action key={item.key} id={item.action}>
          <Button variant="outline" size="sm" />
        </Action>
      ))}
    </div>
  );
}

export default function NotesPage() {
  const [title, setTitle] = useState('');
  const notes = useServiceState('notes.list', (state) => state.notes, []);
  return (
    <>
      <PageHeader title="Notes" subtitle="Owned by the notes plugin; extended by three others." />
      <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={title}
          aria-label="New note"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Action
          id="notes.add"
          input={title}
          onExecuted={(result) => result.status === 'completed' && setTitle('')}
        >
          <Button type="submit" />
        </Action>
      </form>
      <Toolbar />
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <li key={note.id} className="flex items-center gap-2">
            <span className="flex-1">{note.title}</span>
            <Action id="notes.remove" input={note.id}>
              <Button variant="ghost" size="sm" />
            </Action>
          </li>
        ))}
      </ul>
      <PluginSlot name="notes.footer" />
    </>
  );
}
