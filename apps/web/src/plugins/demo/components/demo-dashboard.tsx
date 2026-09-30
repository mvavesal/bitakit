'use client';
import { useTranslations } from 'next-intl';
import { ActionButton, ActionLink } from '@bitakit/ui/actions';
import { ActionMenu } from '@bitakit/ui';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function DemoDashboard() {
  const t = useTranslations('demo.dashboard');
  return (
    <Card id="demo-plugin">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <ActionButton action="demo.hello" as={Button} />
        <ActionMenu group="demo.actions" label={t('menu')} />
        <ActionLink action="demo.settings" className="text-sm underline underline-offset-4" />
      </CardContent>
    </Card>
  );
}
