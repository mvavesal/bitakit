'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { useActiveOrganization } from '@/components/providers/organization-provider';
import { OrganizationPeople } from '@/components/organizations/organization-people';
import { OrganizationManagement } from '@/components/organizations/organization-management';
import type { OrganizationDetails } from '@/lib/organizations/details';
import { PageHeader } from '@/components/layout/page-header';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Details = Omit<ComponentProps<typeof OrganizationPeople>, 'title' | 'organizationId'> & {
  organization: OrganizationDetails;
};
function OrganizationSettings({ view }: { view: 'general' | 'members' }) {
  const active = useActiveOrganization();
  const t = useTranslations('OrgSettings');
  if (active.isPending) return <Skeleton className="h-32 w-full" />;
  if (!active.data)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('noOrganization')}</EmptyTitle>
          <EmptyDescription>{t('selectOrganization')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  // A context switch unmounts forms, clears row selection and cancels old loads.
  return <OrganizationContent key={active.data.id} organizationId={active.data.id} view={view} />;
}
function OrganizationContent({
  organizationId,
  view,
}: {
  organizationId: string;
  view: 'general' | 'members';
}) {
  const t = useTranslations('OrgSettings');
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/organizations/active', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Organization unavailable');
        const result: Details = await response.json();
        if (result.organization.id !== organizationId) throw new Error('Organization changed');
        if (!controller.signal.aborted) {
          setData(result);
          setError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [organizationId, revision]);
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t('loadError')}
          <Button variant="ghost" onClick={refresh}>
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!data) return <Skeleton className="h-48 w-full" />;
  const { organization, ...people } = data;
  if (view === 'members')
    return (
      <OrganizationPeople
        {...people}
        organizationId={organizationId}
        title={t('members')}
        subtitle={organization.name}
        onRefresh={refresh}
      />
    );
  return (
    <div className="flex min-w-0 flex-col gap-8 md:gap-10">
      <PageHeader title={t('general')} subtitle={organization.name} />
      <div className="w-full max-w-2xl">
        <OrganizationManagement organization={organization} onSaved={refresh} />
      </div>
    </div>
  );
}
export function OrganizationGeneralSettings() {
  return <OrganizationSettings view="general" />;
}
export function OrganizationMembersSettings() {
  return <OrganizationSettings view="members" />;
}
