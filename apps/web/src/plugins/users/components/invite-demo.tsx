'use client';
import { useTranslations } from 'next-intl';
import { ActionMenu } from '@bitakit/ui';
import { ActionButton } from '@bitakit/ui/actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function InviteDemo() {
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
