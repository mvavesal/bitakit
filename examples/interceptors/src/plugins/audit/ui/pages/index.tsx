'use client';
import { Action, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';

const labels = { action: 'Action', call: 'Service call', error: 'Failed' } as const;

// Served at /audit: what the two interceptors in this plugin recorded, newest first.
export default function AuditPage() {
  const entries = useServiceState('audit.log', (state) => state.entries, []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        subtitle="Recorded by interceptors; the customers plugin does not know about it."
        trailing={
          <Action id="audit.clear">
            <Button variant="outline" />
          </Action>
        }
      />
      {entries.length ? (
        <ItemGroup>
          {entries.map((entry) => (
            <Item key={entry.id} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  <Badge variant={entry.kind === 'error' ? 'destructive' : 'secondary'}>
                    {labels[entry.kind]}
                  </Badge>
                  <code>{entry.text}</code>
                </ItemTitle>
                <ItemDescription>{new Date(entry.at).toLocaleTimeString()}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Add, archive or remove a customer, then come back.
        </p>
      )}
    </div>
  );
}
