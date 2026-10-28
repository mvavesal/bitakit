'use client';
import { useState } from 'react';
import { Action, useServiceState, type SlotProps } from '@bitakit/ui';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@bitakit/ui/components';
import { euros } from '../euros';

// The deals section on a company's page, filled from this plugin's folder.
export default function CompanyDeals({ payload }: SlotProps<'companies.detail'>) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const deals = useServiceState(
    'deals.board',
    (state) => state.deals.filter((deal) => deal.companyId === payload.companyId),
    [],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deals</CardTitle>
        <CardDescription>From the deals plugin.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1 text-sm">
          {deals.map((deal) => (
            <li key={deal.id} className="flex items-center gap-2">
              {deal.title} <span className="text-muted-foreground">· {euros(deal.value)}</span>
              <Badge variant="secondary">{deal.stage}</Badge>
            </li>
          ))}
          {!deals.length && <li className="text-muted-foreground">No deals yet.</li>}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => event.preventDefault()}>
          <Input
            value={title}
            aria-label="Deal title"
            placeholder="Title"
            className="sm:max-w-48"
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            value={value}
            type="number"
            min={1}
            aria-label="Deal value in euros"
            placeholder="Value (€)"
            className="sm:max-w-32"
            onChange={(event) => setValue(event.target.value)}
          />
          <Action
            id="deals.add"
            input={{ companyId: payload.companyId, title, value: Number(value) }}
            onExecuted={(result) => {
              if (result.status !== 'completed') return;
              setTitle('');
              setValue('');
            }}
          >
            <Button type="submit" variant="outline" />
          </Action>
        </form>
      </CardContent>
    </Card>
  );
}
