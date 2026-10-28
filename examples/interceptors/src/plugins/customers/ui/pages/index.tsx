'use client';
import { useState } from 'react';
import { Action, useServiceState } from '@bitakit/ui';
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
} from '@bitakit/ui/components';

// Served at /customers. An ordinary feature page: nothing here mentions audit or guard.
export default function CustomersPage() {
  const [name, setName] = useState('');
  const customers = useServiceState('customers.list', (state) => state.customers, []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        subtitle="Two other plugins watch and gate these buttons without changing this folder."
      />
      <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={name}
          aria-label="Customer name"
          placeholder="Customer name"
          onChange={(event) => setName(event.target.value)}
        />
        <Action
          id="customers.add"
          input={name}
          onExecuted={(result) => result.status === 'completed' && setName('')}
        >
          <Button type="submit" />
        </Action>
      </form>
      <ItemGroup>
        {customers.map((customer) => (
          <Item key={customer.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {customer.name}
                {customer.status === 'archived' && <Badge variant="secondary">archived</Badge>}
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <Action id="customers.archive" input={customer.id}>
                <Button variant="outline" size="sm" />
              </Action>
              <Action id="customers.remove" input={customer.id}>
                <Button variant="outline" size="sm" />
              </Action>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
