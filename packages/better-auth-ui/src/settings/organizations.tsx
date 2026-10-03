'use client';
import { Suspense, useSyncExternalStore } from 'react';
import { cn } from 'cn';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { getService } from '@bitakit/core';
import { useFoundation, useServiceState, useTranslation } from '@bitakit/ui';
import {
  organizationService,
  organizationGroups,
  isOrganizationWebsite,
  type OrganizationSnapshot,
} from '@bitakit/organizations';
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/index.js';
import { OrganizationDialog } from '../components/organizations/organization-dialog.js';
import { GroupActions } from '../components/organizations/group-actions.js';
import { OrganizationsPage } from '../components/organizations/pages.js';
import { IncomingInvitations } from '../components/organizations/incoming-invitations.js';

/** `embedded`: rendered inside a host frame that owns the page title and width. */
type ViewProps = { embedded?: boolean };

export function OrganizationMembersSettings({ embedded }: ViewProps) {
  return <OrganizationsPage embedded={embedded} />;
}
export function OrganizationInvitationsSettings({ embedded }: ViewProps) {
  return <OrganizationsPage embedded={embedded} />;
}
export function OrganizationSettings({ embedded = false }: ViewProps) {
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
            {translateUI('foundationUI.organizations.reload', undefined, 'Reload')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!state.loaded && state.pending)
    return (
      <p role="status">
        {translateUI(
          'foundationUI.organizations.loadingOrganizations',
          undefined,
          'Loading organizations…',
        )}
      </p>
    );
  if (!state.activeId)
    return (
      <p>
        {translateUI(
          'foundationUI.organizations.selectAnOrganization',
          undefined,
          'Select an organization.',
        )}
      </p>
    );
  return (
    <section className={cn('flex w-full flex-col gap-7', !embedded && 'mx-auto max-w-4xl')}>
      <PageHeader
        level={embedded ? 2 : 1}
        title={
          state.canManage
            ? translateUI(
                'foundationUI.organizations.organizationSettings',
                undefined,
                'Organization settings',
              )
            : translateUI(
                'foundationUI.organizations.organizationProfile',
                undefined,
                'Organization profile',
              )
        }
        subtitle={
          state.canManage
            ? translateUI(
                'foundationUI.organizations.manageYourWorkspaceAppearanceAndDetails',
                undefined,
                'Manage your workspace appearance and details.',
              )
            : translateUI(
                'foundationUI.organizations.informationAboutYourWorkspace',
                undefined,
                'Information about your workspace.',
              )
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
                  <AvatarImage
                    src={organization.logo}
                    alt={translateUI(
                      'foundationUI.organizations.organizationLogo',
                      undefined,
                      'Organization logo',
                    )}
                  />
                )}
                <AvatarFallback>{organization?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{organization?.name}</ItemTitle>
              <ItemDescription>
                {translateUI('foundationUI.organizations.identifier', undefined, 'Identifier:')}
                {organization?.slug}
              </ItemDescription>
              <ItemDescription>
                {translateUI('foundationUI.organizations.website', undefined, 'Website:')}{' '}
                {organization?.website && isOrganizationWebsite(organization.website) ? (
                  <a href={organization.website} target="_blank" rel="noopener noreferrer">
                    {organization.website}
                  </a>
                ) : (
                  organization?.website ||
                  translateUI('foundationUI.organizations.notSpecified', undefined, 'Not specified')
                )}
              </ItemDescription>
              <ItemDescription>
                {translateUI(
                  'foundationUI.organizations.youCanViewTheseDetailsButCannotEditThem',
                  undefined,
                  'You can view these details but cannot edit them.',
                )}
              </ItemDescription>
            </ItemContent>
          </Item>
        )}
      </div>
    </section>
  );
}

const organizationTabs = ['profile', 'members', 'invitations'] as const;
const organizationTab = parseAsStringLiteral(organizationTabs).withDefault('profile');

function Loading() {
  const translateUI = useTranslation();
  return (
    <p role="status">
      {translateUI(
        'foundationUI.organizations.loadingOrganizations',
        undefined,
        'Loading organizations…',
      )}
    </p>
  );
}
function OrganizationSettingsTabs() {
  const translateUI = useTranslation();
  const [tab, setTab] = useQueryState('tab', organizationTab);
  // Undefined until the runtime is ready; the views below read the service directly.
  const canManage = useServiceState(
    organizationService,
    (state) => (state as OrganizationSnapshot).canManage,
    undefined,
  );
  if (canManage === undefined) return <Loading />;
  const selected = tab === 'members' && !canManage ? 'profile' : tab;
  return (
    <Tabs value={selected} onValueChange={(value) => void setTab(organizationTab.parse(value))}>
      {/* On narrow screens the bar scrolls instead of the page; the padding keeps the line
          indicator below the active tab inside the scroll area. */}
      <div className="overflow-x-auto pb-1">
        <TabsList
          variant="line"
          aria-label={translateUI(
            'foundationUI.organizations.organizationSettings',
            undefined,
            'Organization settings',
          )}
        >
          <TabsTrigger value="profile">
            {translateUI('foundationUI.organizations.profile', undefined, 'Profile')}
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="members">
              {translateUI(
                'foundationUI.organizations.membersAndInvitations',
                undefined,
                'Members and invitations',
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="invitations">
            {translateUI(
              'foundationUI.organizations.invitationsForMe',
              undefined,
              'Invitations for me',
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="profile">
        <OrganizationSettings embedded />
      </TabsContent>
      {canManage && (
        <TabsContent value="members">
          <OrganizationMembersSettings embedded />
        </TabsContent>
      )}
      <TabsContent value="invitations">
        <IncomingInvitations embedded />
      </TabsContent>
    </Tabs>
  );
}

/**
 * The plugin's settings page: the organization profile, its members and sent invitations
 * (only for members who can manage it) and the invitations addressed to the viewer. The host's
 * settings frame renders the page title and navigation; the selected tab is URL state (`tab`).
 */
export function OrganizationSettingsPage() {
  // Search parameters suspend during static rendering, so the URL-backed part has a boundary.
  return (
    <Suspense fallback={<Loading />}>
      <OrganizationSettingsTabs />
    </Suspense>
  );
}
