'use client';
import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';
import BuildingIcon from 'reicon-react/icons/Building';
import { useActiveOrganization } from '@/providers/organization-provider';
import { organizationDialogParser } from './organization-create-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { SettingsLink } from '@/components/settings/base/settings-link';
export function OrganizationWorkspace() {
  const active = useActiveOrganization();
  const t = useTranslations('OrgSettings');
  const organizations = useTranslations('Organizations');
  const [, setSelection] = useQueryState('organization', organizationDialogParser);
  if (active.isPending) return <Skeleton className="h-40 w-full" />;
  if (!active.data)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BuildingIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('noOrganization')}</EmptyTitle>
          <EmptyDescription>{t('selectOrganization')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => void setSelection('new')}>{organizations('createTitle')}</Button>
        </EmptyContent>
      </Empty>
    );
  return (
    <PageHeader
      title={active.data.name}
      subtitle={t('workspaceDescription')}
      trailing={
        <Button variant="outline" asChild>
          <SettingsLink href="/settings/organization">{t('title')}</SettingsLink>
        </Button>
      }
    />
  );
}
