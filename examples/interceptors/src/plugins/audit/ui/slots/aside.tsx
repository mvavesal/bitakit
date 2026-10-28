'use client';
import { Action, useServiceState } from '@bitakit/ui';
import { Badge, Button } from '@bitakit/ui/components';
import BoltIcon from 'reicon-react/icons/Bolt';
import DangerIcon from 'reicon-react/icons/Danger';
import DatabaseIcon from 'reicon-react/icons/Database';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const kinds = {
  action: { label: 'Action', icon: BoltIcon, variant: 'default' },
  call: { label: 'Service call', icon: DatabaseIcon, variant: 'secondary' },
  error: { label: 'Failed', icon: DangerIcon, variant: 'destructive' },
} as const;

// In the app's `aside` column next to every page: what the interceptors in this plugin record,
// live and newest first. The customers plugin does not know this panel exists.
export default function AuditPanel() {
  const entries = useServiceState('audit.log', (state) => state.entries, []);
  return (
    <section aria-label="Audit log" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div>
          <h2 className="font-medium">Audit log</h2>
          <p className="text-sm text-muted-foreground">Recorded by interceptors while you click.</p>
        </div>
        <Action id="audit.clear">
          <Button variant="ghost" size="sm" />
        </Action>
      </div>
      {entries.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>What happened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const kind = kinds[entry.kind];
              return (
                <TableRow key={entry.id}>
                  <TableCell className="align-top text-muted-foreground tabular-nums">
                    {new Date(entry.at).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={kind.variant}>
                      <kind.icon data-icon="inline-start" aria-hidden="true" />
                      {kind.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs break-words whitespace-normal">
                    {entry.text}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="px-3 text-sm text-muted-foreground">
          Nothing yet. Add, archive or remove a customer.
        </p>
      )}
    </section>
  );
}
