'use client';
import { useServiceState } from '@bitakit/ui';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';

const time = new Intl.DateTimeFormat('en', { timeStyle: 'short' });

// Served at /activity: what the other plugins announced since the page was opened.
export default function ActivityPage() {
  const entries = useServiceState('activity.feed', (state) => state.entries, []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activity" subtitle="Events from companies, contacts and deals." />
      {entries.length ? (
        <ItemGroup>
          {entries.map((entry) => (
            <Item key={entry.id} variant="outline">
              <ItemContent>
                <ItemTitle>{entry.text}</ItemTitle>
                <ItemDescription>{time.format(new Date(entry.at))}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Add a company or a contact, or win a deal.
        </p>
      )}
    </div>
  );
}
