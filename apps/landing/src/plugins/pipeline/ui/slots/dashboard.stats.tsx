'use client';
import { useFormatter } from 'next-intl';
import TrendUpIcon from 'reicon-react/icons/TrendUp';
import { useServiceState, useSetting, useTranslation } from '@bitakit/ui';
import { StatCard } from '@/components/ui/stat-card';

export const order = 30;

/** The value of open deals; the sparkline is each deal in the order it was added. */
export default function PipelineStat() {
  const t = useTranslation();
  const format = useFormatter();
  const deals = useServiceState('pipeline.deals', (state) => state.deals, []);
  const currency = String(useSetting('currency').value);
  const open = deals.filter((deal) => deal.stage !== 'won');
  return (
    <StatCard
      icon={TrendUpIcon}
      title={t('pipeline.stat.title', undefined, 'Open pipeline')}
      caption={t('pipeline.stat.caption', undefined, 'Deals not won yet')}
      value={format.number(
        open.reduce((sum, deal) => sum + deal.amount, 0),
        { style: 'currency', currency, maximumFractionDigits: 0 },
      )}
      series={[...deals].reverse().map((deal) => deal.amount)}
      color="var(--chart-2)"
    />
  );
}
