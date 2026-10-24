'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

const plugins = [
  ['notes', 'owns the notes, their event, settings and two slots'],
  ['activity', 'listens to notes.changed; adds a feed and a header count'],
  ['export', 'adds an Action to the notes toolbar'],
  ['guard', 'blocks duplicate notes and traces the notes service'],
];

export default function Home() {
  return (
    <>
      <PageHeader
        title="Workspace example"
        subtitle="Four plugins, four folders, no shared edits."
      />
      <ul className="flex flex-col gap-1">
        {plugins.map(([id, role]) => (
          <li key={id}>
            <code>src/plugins/{id}</code> {role}
          </li>
        ))}
      </ul>
      <ActionLink action="notes.open" />
    </>
  );
}
