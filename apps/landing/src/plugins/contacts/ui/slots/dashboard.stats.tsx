'use client';
import { useFormatter } from 'next-intl';
import ProfileAddIcon from 'reicon-react/icons/ProfileAdd';
import { useServiceState, useTranslation } from '@bitakit/ui';
import { StatCard } from '@/components/ui/stat-card';

export const order = 20;

export default function CustomersStat() {
  const t = useTranslation();
  const format = useFormatter();
  const signups = useServiceState('contacts.people', (state) => state.signups, []);
  return (
    <StatCard
      icon={ProfileAddIcon}
      title={t('contacts.stat.title', undefined, 'New customers')}
      caption={t('contacts.stat.caption', undefined, 'Last 28 days')}
      value={format.number(signups.reduce((sum, day) => sum + day, 0))}
      series={signups}
      color="var(--chart-3)"
    />
  );
}
