'use client';
import { Action, useServiceState } from '@bitakit/ui';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@bitakit/ui/components';
import type { Deal, Stage } from '../../services/board';
import { euros } from '../euros';

const columns: { stage: Stage; title: string }[] = [
  { stage: 'lead', title: 'Lead' },
  { stage: 'qualified', title: 'Qualified' },
  { stage: 'proposal', title: 'Proposal' },
  { stage: 'won', title: 'Won' },
];

// Served at /deals: the pipeline as columns. Each card's buttons run Actions with the deal's id.
export default function DealsPage() {
  const deals = useServiceState('deals.board', (state) => state.deals, []);
  const status = useServiceState('deals.board', (state) => state.status, 'loading');
  const companies = useServiceState('companies.list', (state) => state.companies, []);
  const companyName = (id: number) => companies.find((company) => company.id === id)?.name ?? '';
  const lost = deals.filter((deal) => deal.stage === 'lost').length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deals"
        subtitle={
          lost
            ? `${lost} lost deal${lost === 1 ? '' : 's'} hidden.`
            : 'Add deals on a company page.'
        }
      />
      {status === 'loading' ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map(({ stage, title }) => {
            const inStage = deals.filter((deal) => deal.stage === stage);
            return (
              <section key={stage} aria-label={title} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  {title} <Badge variant="secondary">{inStage.length}</Badge>
                </h2>
                {inStage.map((deal) => (
                  <DealCard key={deal.id} deal={deal} company={companyName(deal.companyId)} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, company }: { deal: Deal; company: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{deal.title}</CardTitle>
        <CardDescription>
          {company} · {euros(deal.value)}
        </CardDescription>
      </CardHeader>
      {/* Hidden Actions render nothing: won deals show no buttons. */}
      <CardFooter className="flex-wrap gap-2">
        <Action id="deals.advance" input={deal.id}>
          <Button size="sm" />
        </Action>
        <Action id="deals.lose" input={deal.id}>
          <Button size="sm" variant="ghost" />
        </Action>
      </CardFooter>
    </Card>
  );
}
