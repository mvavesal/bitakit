'use client';
import { Action, useServiceState } from '@bitakit/ui';
import { Button, PageHeader } from '@bitakit/ui/components';

export default function CounterPage() {
  const count = useServiceState('counter.value', (state) => state.count, 0);
  return (
    <>
      <PageHeader title="Counter" subtitle="One plugin: a page, a service and two Actions." />
      <output aria-label="Count">{count}</output>
      <Action id="counter.increment">
        <Button />
      </Action>
      <Action id="counter.reset">
        <Button variant="outline" />
      </Action>
    </>
  );
}
