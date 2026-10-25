'use client';
import { useServiceState, useTranslation } from '@bitakit/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bitakit/ui/components';
import { PersonAvatar } from '../avatar';

export const order = 50;

/** The first contacts, with initials. */
export default function ContactsWidget() {
  const t = useTranslation();
  const people = useServiceState('contacts.people', (state) => state.people, []);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t('contacts.widget.title', undefined, 'Contacts')}</CardTitle>
        <CardDescription className="text-xs">
          {t('contacts.widget.count', { count: people.length }, `${people.length} people`)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-xs">
          {people.slice(0, 4).map((person) => (
            <li key={person.id} className="flex items-center gap-2.5">
              <PersonAvatar name={person.name} photo={person.photo} className="size-8" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {person.role}, {person.company}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
