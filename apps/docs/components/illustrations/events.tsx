'use client';
import { useId, useState } from 'react';
import { Frame, Target, Explanation } from './shared';

const participants = [
  {
    key: 'publisher',
    label: 'Counter publishes',
    explanation:
      'After the operation, the declaring plugin emits counter.incremented. This is the Counter Action from the previous step.',
    file: 'src/plugins/counter/actions/increment.ts',
    code: `import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Increment',
  execute: ({ services, settings, events }) => {
    services.counter.value.increment(settings.counter.step.get());
    events.emit('counter.incremented', services.counter.value.state.get().count);
  },
});`,
  },
  {
    key: 'audit',
    label: 'Audit listens',
    explanation:
      'This service logs the notification. Its subscription is automatically released when the service stops.',
    file: 'src/plugins/audit/services/log.ts',
    code: `import { defineService } from '@bitakit/core';

export default defineService(({ events }) => {
  events.on('counter.incremented', ({ data }) => console.log('Count:', data));
  return {};
});`,
  },
  {
    key: 'activity',
    label: 'Activity listens',
    explanation:
      'A second, independent service records the latest notification in its own store. This is a last-observed value, not a second owner of the Counter state; earlier events are not replayed.',
    file: 'src/plugins/activity/services/feed.ts',
    code: `import { defineService } from '@bitakit/core';

export default defineService(({ events, store }) => {
  const state = store({ lastObservedCount: null as number | null });
  events.on('counter.incremented', ({ data }) => {
    state.set({ lastObservedCount: data });
  });
  return { state };
});`,
  },
];

export function EventIllustration() {
  const [selected, select] = useState('audit');
  const details = useId();
  const current = participants.find((item) => item.key === selected)!;
  const target = (key: string) => (
    <Target
      region={participants.find((item) => item.key === key)!}
      selected={selected}
      select={select}
      controls={details}
    />
  );
  return (
    <Frame
      label="Explore event participants"
      caption="Select the publisher or either listener to read its code. One event reaches both subscribed services; selecting a box does not emit an event."
    >
      <div className="space-y-3 rounded-xl border border-fd-border bg-fd-card p-4">
        {target('publisher')}
        <p className="text-center text-sm">
          <span aria-hidden="true">↓ </span>
          <code>counter.incremented</code>
        </p>
        <p className="text-center text-sm text-fd-muted-foreground">
          Delivered to both subscribers
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {target('audit')}
          {target('activity')}
        </div>
      </div>
      <Explanation id={details} region={current} file={current.file} code={current.code} />
    </Frame>
  );
}
