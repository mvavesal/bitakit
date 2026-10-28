'use client';
import { useMemo } from 'react';
import { PluginSlot, useServiceState } from '@bitakit/ui';
import { PageHeader, Skeleton } from '@bitakit/ui/components';

// Served at /companies/<id>. The sections below the header come from other plugins through the
// companies.detail slot; this page only passes them the company's id.
export default function CompanyPage({ params }: { params: { id: string } }) {
  const companyId = Number(params.id);
  const company = useServiceState('companies.list', (state) =>
    state.companies.find((candidate) => candidate.id === companyId),
  );
  const status = useServiceState('companies.list', (state) => state.status, 'loading');
  // A stable payload object: contributions render again only when it changes.
  const payload = useMemo(() => ({ companyId }), [companyId]);
  if (status === 'loading') return <Skeleton className="h-24 w-full" />;
  if (!company)
    return <PageHeader title="Company not found" subtitle={`No company with id ${params.id}.`} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={company.name} subtitle={company.industry} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PluginSlot name="companies.detail" payload={payload} />
      </div>
    </div>
  );
}
