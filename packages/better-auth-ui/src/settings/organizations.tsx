'use client';
import { useTranslation } from '@bitakit/ui';
import { useSyncExternalStore } from 'react';
import { getService, type Setup } from '@bitakit/core';
import { useFoundation } from '@bitakit/ui';
import {
  organizationService,
  organizationGroups,
  isOrganizationWebsite,
} from '@bitakit/organizations';
import {
  SettingsSection,
  type AppPreferences,
  type SectionOptions,
} from '@bitakit/app-preferences/core';
import BuildingIcon from 'reicon-react/icons/Building';
import UsersIcon from 'reicon-react/icons/Users';
import SendIcon from 'reicon-react/icons/Send';
import {  Alert, AlertDescription  } from '../components/ui/index.js';
import {  Button  } from '../components/ui/index.js';
import {  Item, ItemContent, ItemTitle, ItemDescription, ItemMedia  } from '../components/ui/index.js';
import {  PageHeader  } from '../components/ui/index.js';
import {  Avatar, AvatarImage, AvatarFallback  } from '../components/ui/index.js';
import { OrganizationDialog } from '../components/organizations/organization-dialog.js';
import { GroupActions } from '../components/organizations/group-actions.js';
import { OrganizationsPage } from '../components/organizations/pages.js';
import { IncomingInvitations } from '../components/organizations/incoming-invitations.js';

export function OrganizationMembersSettings() {
  return <OrganizationsPage />;
}
export function OrganizationInvitationsSettings() {
  return <OrganizationsPage />;
}
export function OrganizationSettings() {
  const translateUI = useTranslation();
  const service = getService(useFoundation().runtime.services, organizationService);
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const organization = state.organizations.find((item) => item.id === state.activeId);
  if (!state.activeId && state.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {state.error}
          <Button
            variant="outline"
            disabled={state.pending}
            onClick={() => void service.refresh().catch(() => {})}
          >
            {translateUI("foundationUI.organizations.reload", undefined, "Erneut laden")}</Button>
        </AlertDescription>
      </Alert>
    );
  if (!state.loaded && state.pending) return <p role="status">{translateUI("foundationUI.organizations.loadingOrganizations", undefined, "Organisationen werden geladen …")}</p>;
  if (!state.activeId) return <p>{translateUI("foundationUI.organizations.selectAnOrganization", undefined, "Bitte wähle eine Organisation.")}</p>;
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-7">
      <PageHeader
        title={state.canManage ? translateUI("foundationUI.organizations.organizationSettings", undefined, "Organisationseinstellungen") : translateUI("foundationUI.organizations.organizationProfile", undefined, "Organisationsprofil")}
        subtitle={
          state.canManage
            ? translateUI("foundationUI.organizations.manageYourWorkspaceAppearanceAndDetails", undefined, "Verwalte das Erscheinungsbild und die Angaben deines Arbeitsbereichs.")
            : translateUI("foundationUI.organizations.informationAboutYourWorkspace", undefined, "Informationen zu deinem Arbeitsbereich.")
        }
      />
      <div className="flex min-w-0 flex-col gap-6">
        {state.canManage && service.capabilities.update ? (
          <OrganizationDialog
            secondaryActions={
              state.canDelete && service.capabilities.delete ? (
                <GroupActions
                  size="default"
                  group={organizationGroups.danger}
                  context={{ organizationId: state.activeId }}
                />
              ) : undefined
            }
            embedded
            key={state.activeId}
            service={service}
            organizationId={state.activeId}
            close={() => {}}
          />
        ) : (
          <Item variant="outline">
            <ItemMedia>
              <Avatar>
                {organization?.logo && (
                  <AvatarImage src={organization.logo} alt={translateUI("foundationUI.organizations.organizationLogo", undefined, "Organisationslogo")} />
                )}
                <AvatarFallback>{organization?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{organization?.name}</ItemTitle>
              <ItemDescription>{translateUI("foundationUI.organizations.identifier", undefined, "Kennung:")}{organization?.slug}</ItemDescription>
              <ItemDescription>
                {translateUI("foundationUI.organizations.website", undefined, "Website:")}{' '}
                {organization?.website && isOrganizationWebsite(organization.website) ? (
                  <a href={organization.website} target="_blank" rel="noopener noreferrer">
                    {organization.website}
                  </a>
                ) : (
                  organization?.website || translateUI("foundationUI.organizations.notSpecified", undefined, "Nicht angegeben")
                )}
              </ItemDescription>
              <ItemDescription>
                {translateUI("foundationUI.organizations.youCanViewTheseDetailsButCannotEditThem", undefined, "Du kannst diese Angaben ansehen, aber nicht bearbeiten.")}</ItemDescription>
            </ItemContent>
          </Item>
        )}
      </div>
    </section>
  );
}

/** Registers the existing catalog sections and owns their role subscription cleanup. */
export function registerOrganizationSettings(
  options: {
    settings?: AppPreferences;
    settingsCategory?: SectionOptions['category'];
    invitationsCategory?: SectionOptions['category'];
  },
  { app, services }: Parameters<Setup>[0],
) {
  if (options.settings) {
    const catalog = options.settings;
    const service = getService(services, organizationService);
    for (const section of [
      new SettingsSection({
        pluginId: 'organizations-ui',
        id: 'organization',
        navigation: { id: 'organizations.settings', shortcut: 'Alt+Shift+O' },
        icon: BuildingIcon,
        title: 'Organisationsprofil',
        component: OrganizationSettings,
        category: { id: 'organization', title: 'Organisation' },
      }),
      new SettingsSection({
        pluginId: 'organizations-ui',
        id: 'organization-members',
        icon: UsersIcon,
        title: 'Mitglieder und Einladungen',
        visible: service.getSnapshot().canManage,
        description: 'Mitglieder und versendete Einladungen der aktiven Organisation verwalten.',
        component: OrganizationMembersSettings,
        category: { id: 'organization', title: 'Organisation' },
      }),
      new SettingsSection({
        pluginId: 'organizations-ui',
        id: 'received-invitations',
        icon: SendIcon,
        title: 'Einladungen an mich',
        description: 'Einladungen, anderen Organisationen beizutreten.',
        component: IncomingInvitations,
        category: { id: 'organization', title: 'Organisation' },
      }),
    ])
      app.own(
        options.settings.add(
          new SettingsSection({
            ...section,
            showHeader: false,
            category:
              section.id === 'received-invitations'
                ? (options.invitationsCategory ?? options.settingsCategory ?? section.category)
                : (options.settingsCategory ?? section.category),
          }),
        ).remove,
      );
    app.own(
      service.subscribe(() => {
        const visible = service.getSnapshot().canManage;
        if (catalog.getSection('organization-members')?.visible !== visible)
          catalog.updateSection('organization-members', { visible });
      }),
    );
  }
}
