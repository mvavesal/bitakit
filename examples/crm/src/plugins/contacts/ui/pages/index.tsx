'use client';
import { useServiceState } from '@bitakit/ui';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  Skeleton,
} from '@bitakit/ui/components';

// Served at /contacts: everyone in the CRM, with their company's name read from the companies
// plugin's service (an empty name while it loads).
export default function ContactsPage() {
  const contacts = useServiceState('contacts.list', (state) => state.contacts, []);
  const status = useServiceState('contacts.list', (state) => state.status, 'loading');
  const companies = useServiceState('companies.list', (state) => state.companies, []);
  const companyName = (id: number) => companies.find((company) => company.id === id)?.name ?? '';
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Contacts" subtitle="Add people on a company's page." />
      {status === 'loading' ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ItemGroup>
          {contacts.map((contact) => (
            <Item key={contact.id} variant="outline">
              <ItemContent>
                <ItemTitle>{contact.name}</ItemTitle>
                <ItemDescription>
                  {contact.email} · {companyName(contact.companyId)}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
