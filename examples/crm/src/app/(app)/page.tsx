'use client';
import { ActionLink } from '@bitakit/ui';
import { PageHeader } from '@bitakit/ui/components';

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="CRM example"
        subtitle="Four plugins, one SQLite database: companies, contacts, deals and activity."
      />
      <div className="flex flex-wrap gap-4">
        <ActionLink action="companies.open" />
        <ActionLink action="contacts.open" />
        <ActionLink action="deals.open" />
        <ActionLink action="activity.open" />
      </div>
    </div>
  );
}
