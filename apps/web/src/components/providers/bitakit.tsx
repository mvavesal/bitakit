'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ActionFailure } from '@bitakit/core';
import { useSettings } from '@bitakit/app-preferences';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import { betterAuthPlugin } from '@bitakit/better-auth';
import { betterAuthOrganizations } from '@bitakit/better-auth/organizations';
import { organizationUIPlugin } from '@bitakit/better-auth-ui/organizations';
import { useNextIntlPlugin } from '@bitakit/next-intl';
import { organizationsPlugin, type OrganizationInput } from '@bitakit/organizations';
import { BitaKitProvider } from '@/bitakit.gen';
import { logout } from '@/app/auth-actions';
import { foundationUI } from '@/components/foundation/ui';
import { SettingsLink } from '@/components/settings/base/settings-link';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/notifications';

const notifyToast = (message: string, kind: 'success' | 'failure') =>
  kind === 'failure' ? toast.error(message) : toast.success(message);
// Failures of discovered actions already carry their feedback; anything else gets the generic text.
const actionOptions = {
  Link: SettingsLink,
  onError: (error: unknown) => {
    if (!(error instanceof ActionFailure)) notify.error('saveFailed');
  },
};

/**
 * Mounts the generated BitaKit configuration with this host's additions: the shared
 * AppPreferences instance, next-intl translation, Better Auth and the organizations backend.
 */
export function BitaKit({ children }: { children: ReactNode }) {
  const t = useTranslations('Foundation');
  const settings = useSettings();
  const translation = useNextIntlPlugin();
  const [hostPlugins] = useState(() => [
    betterAuthPlugin(authClient, { signOut: logout }),
    organizationsPlugin(() => betterAuthOrganizations(authClient, organizationBackend)),
    organizationUIPlugin(),
  ]);
  // Same ID as the discovered package plugin, so it is replaced in place instead of duplicated.
  const plugins = useMemo(
    () => [appPreferencesPlugin({ settings }), translation, ...hostPlugins],
    [settings, translation, hostPlugins],
  );
  const labels = useMemo(
    () => ({
      cancel: t('cancel'),
      confirm: t('confirm'),
      submit: t('submit'),
      pending: t('pending'),
      invalid: t('invalid'),
      unavailable: t('unavailable'),
    }),
    [t],
  );
  return (
    <BitaKitProvider
      additionalPlugins={plugins}
      ui={foundationUI}
      labels={labels}
      notify={notifyToast}
      actionOptions={actionOptions}
    >
      {children}
    </BitaKitProvider>
  );
}

/** REST backend of this application's organization routes. */
const organizationBackend = {
  async list() {
    const response = await fetch('/api/organizations');
    if (!response.ok) throw new Error('Organisationen konnten nicht geladen werden.');
    return response.json();
  },
  async create(input: OrganizationInput) {
    const response = await fetch('/api/organizations', {
      method: 'POST',
      body: organizationForm(input),
    });
    if (!response.ok) throw new Error('Organisation konnte nicht erstellt werden.');
    const result = await response.json();
    const active = await authClient.organization.setActive({ organizationId: result.id });
    if (active.error) throw active.error;
  },
  async update(input: OrganizationInput & { organizationId: string }) {
    const response = await fetch(
      `/api/organizations?id=${encodeURIComponent(input.organizationId)}`,
      {
        method: 'PATCH',
        body: organizationForm(input),
      },
    );
    if (!response.ok) throw new Error('Organisation konnte nicht gespeichert werden.');
  },
  async delete(id: string) {
    const response = await fetch(`/api/organizations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Organisation konnte nicht gelöscht werden.');
  },
  async setMemberDisabled(input: unknown) {
    const response = await fetch('/api/organizations/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Die Mitgliedschaft konnte nicht geändert werden.');
  },
  async invite(input: unknown) {
    const response = await fetch('/api/organizations/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Die Einladung konnte nicht gesendet werden.');
  },
};

function organizationForm(input: OrganizationInput) {
  const data = new FormData();
  data.set('name', input.name);
  data.set('slug', input.slug);
  data.set('website', input.website ?? '');
  if (input.logo) data.set('logo', input.logo);
  data.set('removeLogo', String(input.removeLogo ?? false));
  return data;
}
