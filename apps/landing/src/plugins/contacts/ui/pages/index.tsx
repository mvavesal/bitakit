'use client';
import { useServiceState, useTranslation } from '@bitakit/ui';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';
import { PersonAvatar } from '../avatar';

export default function ContactsPage() {
  const t = useTranslation();
  const people = useServiceState('contacts.people', (state) => state.people, []);
  return (
    <>
      <PageHeader
        title={t('contacts.page.title', undefined, 'Contacts')}
        subtitle={t('contacts.page.subtitle', undefined, 'Also searchable with Mod+K.')}
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {people.map((person) => (
          <li key={person.id}>
            <Item variant="outline" className="h-full">
              <ItemMedia>
                <PersonAvatar name={person.name} photo={person.photo} className="size-12" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{person.name}</ItemTitle>
                <ItemDescription>{person.role}</ItemDescription>
                <ItemDescription className="text-xs">{person.company}</ItemDescription>
              </ItemContent>
            </Item>
          </li>
        ))}
      </ul>
    </>
  );
}
