'use client';
import { Action, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  Skeleton,
} from '@bitakit/ui/components';

const priority = { low: 'secondary', normal: 'outline', high: 'destructive' } as const;

// Served at /tickets. "New ticket" opens the form dialog; Close runs an Action with a question.
export default function TicketsPage() {
  const tickets = useServiceState('tickets.list', (state) => state.tickets, []);
  const status = useServiceState('tickets.list', (state) => state.status, 'loading');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tickets"
        subtitle="Forms in dialogs, checked by one schema in the browser and on the server."
        trailing={
          <Action id="tickets.new">
            <Button />
          </Action>
        }
      />
      {status === 'loading' ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ItemGroup>
          {tickets.map((ticket) => (
            <Item key={ticket.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  {ticket.title}
                  <Badge variant={priority[ticket.priority]}>{ticket.priority}</Badge>
                  {ticket.status === 'closed' && <Badge variant="secondary">closed</Badge>}
                </ItemTitle>
                <ItemDescription>
                  {ticket.email} · {ticket.description}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Action id="tickets.close" input={ticket.id}>
                  <Button variant="outline" size="sm" />
                </Action>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
