'use client';
import { SettingsAccountAccess } from './account.js';
import BuildingIcon from 'reicon-react/icons/Building';
import ShieldIcon from 'reicon-react/icons/Shield';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '../components/ui/empty.js';
import { Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from 'cn';
import { getService } from '@bitakit/core';
import { useFoundation, useFoundationReady, useServiceState, useTranslation } from '@bitakit/ui';
import {
  organizationService,
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
} from '../components/ui/index.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card.js';
import { OrganizationDialog } from '../components/organizations/organization-dialog.js';
import { SlotActions } from '../components/organizations/group-actions.js';
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
      <Empty role="status">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BuildingIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            {translateUI(
              'foundationUI.organizations.selectAnOrganization',
              undefined,
              'Select an organization.',
            )}
          </EmptyTitle>
          <EmptyDescription>
            {translateUI(
              'foundationUI.organizations.selectOrganizationHint',
              undefined,
              'Choose an organization from the organization menu to view its profile.',
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <section className={cn('flex w-full flex-col gap-7', !embedded && 'mx-auto max-w-4xl')}>
      {!embedded && (
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
      )}
      <div className="flex min-w-0 flex-col gap-6">
        {state.canManage && service.capabilities.update ? (
          <OrganizationDialog
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
      {state.canDelete && service.capabilities.delete && (
        <Card>
          <CardHeader>
            <CardTitle>
              {translateUI('foundationUI.organizations.dangerZone', undefined, 'Danger zone')}
            </CardTitle>
            <CardDescription>
              {translateUI(
                'foundationUI.organizations.deleteWarning',
                undefined,
                'Deleting this organization permanently removes it and its memberships. This cannot be undone.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="items-end">
            <SlotActions
              variant="destructive"
              size="default"
              slot="organizations.danger"
              context={{ organizationId: state.activeId }}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/** Profile content in the shared settings frame, which owns its heading. */
export function OrganizationSettingsPage() {
  const ready = useFoundationReady();
  if (!ready) return null;
  return (
    <SettingsAccountAccess>
      <OrganizationSettings embedded />
    </SettingsAccountAccess>
  );
}

/** Management remains permission-guarded even when navigating directly to its URL. */
function MembersAccess({ children }: { children: ReactNode }) {
  const translateUI = useTranslation();
  const canManage = useServiceState(
    organizationService,
    (state) => (state as OrganizationSnapshot).canManage,
    undefined,
  );
  if (canManage === undefined) return null;
  if (!canManage)
    return (
      <Empty role="status">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            {translateUI(
              'foundationUI.organizations.managementAccessRequired',
              undefined,
              'Management access required',
            )}
          </EmptyTitle>
          <EmptyDescription>
            {translateUI(
              'foundationUI.organizations.managementUnavailable',
              undefined,
              'You do not have permission to manage this organization.',
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return children;
}

export function OrganizationMembersAccess({ children }: { children: ReactNode }) {
  return (
    <SettingsAccountAccess>
      <MembersAccess>{children}</MembersAccess>
    </SettingsAccountAccess>
  );
}

function OrganizationProfileAccess({ children }: { children: ReactNode }) {
  const state = useServiceState(
    organizationService,
    (state) => state as OrganizationSnapshot,
    undefined,
  );
  if (!state?.loaded || !state.activeId) return <OrganizationSettings embedded />;
  return children;
}

export function OrganizationSettingsAccess({ children }: { children: ReactNode }) {
  return (
    <SettingsAccountAccess>
      <OrganizationProfileAccess>{children}</OrganizationProfileAccess>
    </SettingsAccountAccess>
  );
}

export function OrganizationMembersPage() {
  return (
    <OrganizationMembersAccess>
      <Suspense>
        <OrganizationMembersSettings embedded />
      </Suspense>
    </OrganizationMembersAccess>
  );
}

export function PersonalInvitationsPage() {
  const ready = useFoundationReady();
  if (!ready) return null;
  return (
    <SettingsAccountAccess>
      <Suspense>
        <IncomingInvitations embedded />
      </Suspense>
    </SettingsAccountAccess>
  );
}

function InvitationsAccess({ children }: { children: ReactNode }) {
  const state = useServiceState(
    organizationService,
    (state) => state as OrganizationSnapshot,
    undefined,
  );
  const service = getService(useFoundation().runtime.services, organizationService);
  if (!state?.loaded || state.incomingInvitationsError || !service.capabilities.invitations)
    return (
      <Suspense>
        <IncomingInvitations embedded />
      </Suspense>
    );
  return children;
}

/** Provider loading/verification errors gate extensions together with the native invitation body. */
export function PersonalInvitationsAccess({ children }: { children: ReactNode }) {
  return (
    <SettingsAccountAccess>
      <InvitationsAccess>{children}</InvitationsAccess>
    </SettingsAccountAccess>
  );
}
