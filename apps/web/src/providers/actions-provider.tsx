'use client';
import { organizationsPlugin } from '@bitakit/organizations';
import { organizationUIPlugin } from '@bitakit/better-auth-ui/organizations';
import { betterAuthOrganizations } from '@bitakit/better-auth/organizations';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNextIntlPlugin } from '@bitakit/next-intl';
import { betterAuthPlugin } from '@bitakit/better-auth';
import { authClient } from '@/lib/auth-client';
import { logout } from '@/app/auth-actions';
import { createActionList } from '@bitakit/ui/actions';
import { ActionProvider } from '@bitakit/next/actions';
import { ConfirmationController, type Confirmation } from '@bitakit/core';
import { AppFoundationProvider } from './foundation-provider';
import { ActionConfirmation } from '@/components/navigation/action-confirmation';
import { notify } from '@/lib/notifications';
import { SettingsLink } from '@/components/settings/base/settings-link';
import { ActionFailure } from '@bitakit/core';

export function AppActionsProvider({ children }: { children: ReactNode }) {
  const translation = useNextIntlPlugin();
  const [authentication] = useState(() => betterAuthPlugin(authClient, { signOut: logout }));
  const [organizations] = useState(() =>
    organizationsPlugin(() =>
      betterAuthOrganizations(authClient, {
        async list() {const response=await fetch('/api/organizations');if(!response.ok)throw new Error('Organisationen konnten nicht geladen werden.');return response.json();},
        async create(input) { const data=organizationForm(input); const response=await fetch('/api/organizations',{method:'POST',body:data});if(!response.ok)throw new Error('Organisation konnte nicht erstellt werden.');const result=await response.json();const active=await authClient.organization.setActive({organizationId:result.id});if(active.error)throw active.error;},
        async update(input) {const response=await fetch(`/api/organizations?id=${encodeURIComponent(input.organizationId)}`,{method:'PATCH',body:organizationForm(input)});if(!response.ok)throw new Error('Organisation konnte nicht gespeichert werden.');},
        async delete(id) {const response=await fetch(`/api/organizations?id=${encodeURIComponent(id)}`,{method:'DELETE'});if(!response.ok)throw new Error('Organisation konnte nicht gelöscht werden.');},

        async setMemberDisabled(input) {
          const response = await fetch('/api/organizations/members', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          if (!response.ok) throw new Error('Die Mitgliedschaft konnte nicht geändert werden.');
        },
        async invite(input) {
          const response = await fetch('/api/organizations/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          if (!response.ok) throw new Error('Die Einladung konnte nicht gesendet werden.');
        },
      }),
    ),
  );
  const [organizationUI] = useState(() => organizationUIPlugin());
  const plugins = useMemo(
    () => [translation, authentication, organizations, organizationUI],
    [translation, authentication, organizations, organizationUI],
  );
  const [request, setRequest] = useState<Confirmation | null>(null);
  const [confirmation] = useState(() => new ConfirmationController(setRequest));
  useEffect(() => confirmation.dispose, [confirmation]);
  const [actions] = useState(() => createActionList());
  return (
    <ActionProvider
      actions={actions}
      Link={SettingsLink}
      onError={(error) => {
        if (!(error instanceof ActionFailure)) notify.error('saveFailed');
      }}
    >
      <AppFoundationProvider plugins={plugins} confirm={confirmation.confirm}>
        {children}
      </AppFoundationProvider>
      <ActionConfirmation request={request} onAnswer={confirmation.answer} />
    </ActionProvider>
  );
}

function organizationForm(input: import('@bitakit/organizations').OrganizationInput) {const data=new FormData();data.set('name',input.name);data.set('slug',input.slug);data.set('website',input.website??'');if(input.logo)data.set('logo',input.logo);data.set('removeLogo',String(input.removeLogo??false));return data;}
