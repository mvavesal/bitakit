'use client';
import { useState } from 'react';
import { Action, useServiceState, type SlotProps } from '@bitakit/ui';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@bitakit/ui/components';

// The contacts section on a company's page. The companies plugin passes the company's id and
// knows nothing else about contacts.
export default function CompanyContacts({ payload }: SlotProps<'companies.detail'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const contacts = useServiceState(
    'contacts.list',
    (state) => state.contacts.filter((contact) => contact.companyId === payload.companyId),
    [],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        <CardDescription>From the contacts plugin.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1 text-sm">
          {contacts.map((contact) => (
            <li key={contact.id}>
              {contact.name} <span className="text-muted-foreground">· {contact.email}</span>
            </li>
          ))}
          {!contacts.length && <li className="text-muted-foreground">No contacts yet.</li>}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => event.preventDefault()}>
          <Input
            value={name}
            aria-label="Contact name"
            placeholder="Name"
            className="sm:max-w-40"
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            value={email}
            type="email"
            aria-label="Contact email"
            placeholder="Email"
            className="sm:max-w-52"
            onChange={(event) => setEmail(event.target.value)}
          />
          <Action
            id="contacts.add"
            input={{ companyId: payload.companyId, name, email }}
            onExecuted={(result) => {
              if (result.status !== 'completed') return;
              setName('');
              setEmail('');
            }}
          >
            <Button type="submit" variant="outline" />
          </Action>
        </form>
      </CardContent>
    </Card>
  );
}
