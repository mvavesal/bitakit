'use client';
import { useTranslations } from 'next-intl';
import { ActionButton, ActionMenu } from '@bitakit/ui';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

/** Placed in the dashboard.content slot after the demo card. */
export const order = 10;

export default function InviteDemo() {
  const t = useTranslations('users.dashboard');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('users')}</CardTitle>
        <CardDescription>{t('example')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <ActionButton action="users.invite" as={Button} />
        <ActionMenu group="userManagement.dropdownMenu" label={t('menu')} />
      </CardContent>
    </Card>
  );
}
