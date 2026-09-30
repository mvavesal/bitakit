import { PluginSlot } from '@bitakit/ui';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { OrganizationWorkspace } from '@/components/organizations/organization-workspace';
import { AppBar } from '@/components/layout/app-bar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  const t = await getTranslations('Organizations');
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const cookieStore = await cookies();
  return (
    <SidebarProvider defaultOpen={cookieStore.get('sidebar_state')?.value !== 'false'}>
      <AppSidebar email={user.email} name={user.name} image={user.image} />
      <SidebarInset>
        <AppBar>
          <span>{t('workspace')}</span>
        </AppBar>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 p-4 md:p-8 lg:p-10">
          <PluginSlot name="dashboard.content" />
          <OrganizationWorkspace />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
