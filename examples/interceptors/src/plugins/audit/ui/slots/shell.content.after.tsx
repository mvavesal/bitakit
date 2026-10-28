'use client';
import { Action, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@bitakit/ui/components';

const labels = { action: 'Action', call: 'Service call', error: 'Failed' } as const;

// Below every page: what the interceptors in this plugin record, live and newest first. The
// customers plugin does not know this panel exists.
export default function AuditPanel() {
  const entries = useServiceState('audit.log', (state) => state.entries, []);
  return (
    <Card size="sm" aria-label="Audit log">
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>
          Recorded by interceptors as you click, without leaving the page.
        </CardDescription>
        <CardAction>
          <Action id="audit.clear">
            <Button variant="outline" size="sm" />
          </Action>
        </CardAction>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <ItemGroup>
            {entries.slice(0, 8).map((entry) => (
              <Item key={entry.id} size="sm">
                <ItemContent>
                  <ItemTitle>
                    <Badge variant={entry.kind === 'error' ? 'destructive' : 'secondary'}>
                      {labels[entry.kind]}
                    </Badge>
                    <code>{entry.text}</code>
                  </ItemTitle>
                </ItemContent>
                <ItemDescription>{new Date(entry.at).toLocaleTimeString()}</ItemDescription>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Add, archive or remove a customer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
