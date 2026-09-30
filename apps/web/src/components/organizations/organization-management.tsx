'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActiveOrganization } from '@/providers/organization-provider';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/notifications';
import type { OrganizationDetails } from '@/lib/organizations/details';
import { OrganizationForm } from '@/components/organizations/organization-form';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
export function OrganizationManagement({
  organization,
  onSaved,
}: {
  organization: OrganizationDetails;
  onSaved?: () => void;
}) {
  const t = useTranslations('Organizations');
  const settingsT = useTranslations('OrgSettings');
  const router = useRouter();
  const active = useActiveOrganization();
  const authOrganizations = authClient.useListOrganizations();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<OrganizationDetails | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const roles = organization.role.split(',');
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError(false);
    try {
      const response = await fetch(`/api/organizations?id=${encodeURIComponent(deleting.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error();
      router.replace('/dashboard');
      setDeleting(null);
      notify.success('organizationDeleted', `organization:${deleting.id}`);
      await Promise.all([authOrganizations.refetch(), active.refetch()]);
    } catch {
      setDeleteError(true);
      notify.error('organizationDeleteFailed', `organization:${deleting.id}`);
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <OrganizationForm
      organization={organization}
      footerStart={
        roles.includes('owner') && (
          <Button
            type="button"
            disabled={busy}
            variant="destructive"
            onClick={() => {
              setDeleteError(false);
              setDeleting(organization);
            }}
          >
            {t('delete')}
          </Button>
        )
      }
      onBusyChange={setBusy}
      onSaved={() => {
        router.refresh();
        onSaved?.();
      }}
    />
  );
  return (
    <>
      {roles.includes('owner') || roles.includes('admin') ? (
        form
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{settingsT('readOnly')}</p>
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('name')}</dt>
              <dd>{organization.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('identifier')}</dt>
              <dd>{organization.slug}</dd>
            </div>
            {organization.website && (
              <div>
                <dt className="text-muted-foreground">{t('website')}</dt>
                <dd>{organization.website}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { name: deleting?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{t('deleteError')}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost" disabled={busy}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {busy ? t('wait') : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
