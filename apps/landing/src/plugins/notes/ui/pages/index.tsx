'use client';
import { useTranslation } from '@bitakit/ui';
import { Item, ItemContent, ItemDescription, ItemTitle, PageHeader } from '@bitakit/ui/components';
import notes from '../../data/notes.json';

export default function NotesPage() {
  const t = useTranslation();
  return (
    <>
      <PageHeader title={t('notes.page.title')} subtitle={t('notes.page.subtitle')} />
      {notes.map((note) => (
        <Item key={note.id} variant="outline">
          <ItemContent>
            <ItemTitle>{note.title}</ItemTitle>
            <ItemDescription>{note.body}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </>
  );
}
