import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { PluginRouteContent } from '@/components/foundation/plugin-route-content';
export default async function PluginRoute({
  params,
  searchParams,
}: {
  params: Promise<{ plugin: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plugin } = await params;
  if (
    plugin.join('/') === 'organizations' &&
    !(await getAuth().api.getSession({ headers: await headers() }))
  ) {
    const query = await searchParams;
    const invitation = typeof query.invitation === 'string' ? query.invitation : '';
    const target =
      '/organizations' + (invitation ? '?invitation=' + encodeURIComponent(invitation) : '');
    redirect('/login?returnTo=' + encodeURIComponent(target));
  }
  return (
    <Suspense>
      <PluginRouteContent />
    </Suspense>
  );
}
