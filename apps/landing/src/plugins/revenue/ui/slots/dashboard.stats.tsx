'use client';
import { useFormatter } from 'next-intl';
import DollarCircleIcon from 'reicon-react/icons/DollarCircle';
import { useServiceState, useSetting, useTranslation } from '@bitakit/ui';
import { StatCard } from '@/components/ui/stat-card';

export const order = 10;

export default function RevenueStat() {
  const t = useTranslation();
  const format = useFormatter();
  const days = useServiceState('revenue.data', (state) => state.days, []);
  const currency = String(useSetting('currency').value);
  return (
    <StatCard
      icon={DollarCircleIcon}
      title={t('revenue.stat.title', undefined, 'Revenue')}
      caption={t('revenue.stat.caption', undefined, 'Last 28 days')}
      value={format.number(
        days.reduce((sum, day) => sum + day, 0),
        { style: 'currency', currency, maximumFractionDigits: 0 },
      )}
      series={days}
      color="var(--chart-1)"
    />
  );
}
