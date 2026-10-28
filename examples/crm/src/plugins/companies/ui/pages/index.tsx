'use client';
import { useState } from 'react';
import { Action, useBitaKitNavigation, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
  PageHeader,
  Skeleton,
} from '@bitakit/ui/components';

// Served at /companies: every company, and a form that runs the companies.add Action.
export default function CompaniesPage() {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const companies = useServiceState('companies.list', (state) => state.companies, []);
  const status = useServiceState('companies.list', (state) => state.status, 'loading');
  // The framework's link component, so moving to a company does not reload the app.
  const Link = useBitaKitNavigation().Link ?? 'a';
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Companies" subtitle="Open a company to see its contacts and deals." />
      <form className="flex flex-wrap gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={name}
          aria-label="Company name"
          placeholder="Company name"
          className="sm:max-w-xs"
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          value={industry}
          aria-label="Industry"
          placeholder="Industry"
          className="sm:max-w-xs"
          onChange={(event) => setIndustry(event.target.value)}
        />
        <Action
          id="companies.add"
          input={{ name, industry }}
          onExecuted={(result) => {
            if (result.status !== 'completed') return;
            setName('');
            setIndustry('');
          }}
        >
          <Button type="submit" />
        </Action>
      </form>
      {status === 'loading' ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ItemGroup>
          {companies.map((company) => (
            <Item key={company.id} variant="outline" asChild>
              <Link href={`/companies/${company.id}`}>
                <ItemContent>
                  <ItemTitle>{company.name}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary">{company.industry}</Badge>
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
