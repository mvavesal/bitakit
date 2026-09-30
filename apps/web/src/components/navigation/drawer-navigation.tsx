'use client';
import { useTranslations } from 'next-intl';
import { actionGroups } from '@/actions/groups';
import { ActionDrawer } from './action-drawer';
export function DrawerNavigation() {
  const t = useTranslations('Nav');
  return (
    <ActionDrawer groups={[actionGroups.navigation]} context={undefined} label={t('navigation')} />
  );
}
