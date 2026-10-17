import AcceptIcon from 'reicon-react/icons/CheckCircle';
import RefreshIcon from 'reicon-react/icons/Refresh';
import UserAddIcon from 'reicon-react/icons/UserAdd4';
import RemoveIcon from 'reicon-react/icons/UserRemove';
import BlockIcon from 'reicon-react/icons/UserBlock';
import UnlockIcon from 'reicon-react/icons/LockSlash';
import RoleIcon from 'reicon-react/icons/ArrowUp3';
import DemoteIcon from 'reicon-react/icons/ArrowDown3';
import CancelIcon from 'reicon-react/icons/Xmark';
import SendIcon from 'reicon-react/icons/Send';
import {
  OrganizationDialog,
  ConfirmOrganizationAction,
} from '../components/organizations/organization-dialog.js';
import { createElement } from 'react';
import { InviteDialog } from '../components/organizations/invite-dialog.js';
import { defineAction, getService, type Contribution, type Services } from '@bitakit/core';
import { organizationService } from '@bitakit/organizations';
import { organizationGroups } from '@bitakit/organizations';
import type { SlotPayload } from '@bitakit/core';
import type {} from '../slots.js';
import type { OrganizationService } from '@bitakit/organizations';
const memberPlacement = [
  {
    slot: 'organizations.member.menu' as const,
    input: ({ payload }: { payload: SlotPayload<'organizations.member.menu'> }) => payload,
  },
];
const ids = {
  page: 'organizations.open',
  create: 'organizations.create',
  invite: 'organizations.invite',
  select: 'organizations.select',
  retry: 'organizations.refresh',
  cancel: 'organizations.cancel',
  resend: 'organizations.resend',
  remove: 'organizations.remove',
  disable: 'organizations.disable',
  enable: 'organizations.enable',
};
/** URL segment of the `organizations-ui` settings section, rendered under `/settings/<path>`. */
export const organizationSettingsPath = 'organization';
function context(input: unknown): {
  organizationId?: string | null;
  memberId?: string;
  invitationId?: string;
} {
  if (!input || typeof input !== 'object') return {};
  const value = input as Record<string, unknown>;
  return {
    organizationId: typeof value.organizationId === 'string' ? value.organizationId : null,
    memberId: typeof value.memberId === 'string' ? value.memberId : undefined,
    invitationId: typeof value.invitationId === 'string' ? value.invitationId : undefined,
  };
}
const organizations = (services: Services) => getService(services, organizationService);
const idle = ({ services }: { services: Services }) =>
  !organizations(services).getSnapshot().pending;

/** Props the host dialog passes to an action's dialog component. */
type DialogProps = { input: unknown; close(): void; services: Services };
function CreateOrganization({ services, close }: DialogProps) {
  return createElement(OrganizationDialog, { service: organizations(services), close });
}
function EditOrganization({ services, input, close }: DialogProps) {
  return createElement(OrganizationDialog, {
    service: organizations(services),
    organizationId: context(input).organizationId,
    close,
  });
}
function DeleteOrganization({ services, input, close }: DialogProps) {
  return createElement(ConfirmOrganizationAction, {
    service: organizations(services),
    organizationId: context(input).organizationId ?? null,
    close,
  });
}
function RemoveMember({ services, input, close }: DialogProps) {
  return createElement(ConfirmOrganizationAction, {
    service: organizations(services),
    organizationId: context(input).organizationId ?? null,
    memberId: context(input).memberId,
    close,
  });
}
const changeRole = (targetRole: 'admin' | 'member') =>
  function ChangeRole({ services, input, close }: DialogProps) {
    return createElement(ConfirmOrganizationAction, {
      service: organizations(services),
      organizationId: context(input).organizationId ?? null,
      memberId: context(input).memberId,
      targetRole,
      close,
    });
  };
function InviteMember({ services, input, close }: DialogProps) {
  return createElement(InviteDialog, {
    service: organizations(services),
    organizationId: context(input).organizationId ?? null,
    close,
  });
}

export function organizationActions(options: {
  path?: string | false;
  groups?: readonly string[];
}): Contribution[] {
  return [
    ...(['accept', 'reject'] as const).map((operation) =>
      defineAction({
        id: `organizations.${operation}`,
        title: operation === 'accept' ? 'Accept' : 'Decline',
        icon: operation === 'accept' ? AcceptIcon : CancelIcon,
        groups: [organizationGroups.incoming],
        slots: [{ slot: 'organizations.incoming', input: ({ payload }) => payload }],
        enabled: idle,
        visible: ({ input, services }) => {
          const service = organizations(services);
          return (
            !!service.capabilities.invitations &&
            !!service
              .getSnapshot()
              .incomingInvitations?.some(
                (item) => item.id === context(input).invitationId && item.status === 'pending',
              )
          );
        },
        execute: ({ services, input }) =>
          organizations(services)[operation](context(input).invitationId ?? ''),
        success: operation === 'accept' ? 'Invitation accepted.' : 'Invitation declined.',
      }),
    ),
    ...(options.path === false
      ? []
      : [
          defineAction({
            id: ids.page,
            title: 'Organizations',
            href: options.path ?? '/organizations',
            groups: options.groups ?? ['navigation'],
          }),
        ]),
    defineAction({
      id: ids.create,
      groups: [],
      title: 'Create organization',
      dialog: CreateOrganization,
    }),
    defineAction({
      id: 'organizations.edit',
      title: 'Edit organization',
      groups: [organizationGroups.management],
      slots: [{ slot: 'organizations.management', input: ({ payload }) => payload }],
      dialog: EditOrganization,
    }),
    defineAction({
      id: 'organizations.delete',
      title: 'Delete organization',
      groups: [organizationGroups.danger],
      slots: [{ slot: 'organizations.danger', input: ({ payload }) => payload }],
      dialog: DeleteOrganization,
    }),
    defineAction({
      id: ids.remove,
      icon: RemoveIcon,
      title: 'Remove',
      groups: [organizationGroups.member],
      slots: memberPlacement,
      enabled: idle,
      visible: ({ input, services }) => {
        const state = organizations(services).getSnapshot();
        const member = state.members.find((item) => item.id === context(input).memberId);
        return state.canManage && !!member && !member.role.split(',').includes('owner');
      },
      dialog: RemoveMember,
    }),
    ...(['admin', 'member'] as const).map((targetRole) =>
      defineAction({
        id: `organizations.${targetRole === 'admin' ? 'promote' : 'demote'}`,
        title: targetRole === 'admin' ? 'Make administrator' : 'Make member',
        icon: targetRole === 'admin' ? RoleIcon : DemoteIcon,
        groups: [organizationGroups.member],
        slots: memberPlacement,
        enabled: idle,
        visible: ({ input, services }) => {
          const state = organizations(services).getSnapshot();
          const member = state.members.find((item) => item.id === context(input).memberId);
          return state.canManage && member?.role === (targetRole === 'admin' ? 'member' : 'admin');
        },
        dialog: changeRole(targetRole),
      }),
    ),
    defineAction({
      id: ids.invite,
      groups: [organizationGroups.members],
      slots: [{ slot: 'organizations.members', input: ({ payload }) => payload }],
      title: 'Invite member',
      icon: UserAddIcon,
      dialog: { component: InviteMember, size: 'wide' },
    }),
    ...(
      [
        [
          ids.select,
          'Switch',
          (service, input) => service.setActive(context(input).organizationId ?? ''),
        ],
        [ids.retry, 'Reload', (service) => service.refresh()],
        [
          ids.cancel,
          'Revoke',
          (service, input) => service.cancel(context(input).invitationId ?? ''),
        ],
        [
          ids.resend,
          'Resend',
          (service, input) => service.resend(context(input).invitationId ?? ''),
        ],
        [
          ids.disable,
          'Suspend',
          (service, input) => service.setDisabled(context(input).memberId ?? '', true),
        ],
        [
          ids.enable,
          'Unsuspend',
          (service, input) => service.setDisabled(context(input).memberId ?? '', false),
        ],
      ] satisfies [
        string,
        string,
        (service: OrganizationService, input: unknown) => Promise<void>,
      ][]
    ).map(([id, title, run]) => {
      const administrative = id !== ids.select && id !== ids.retry;
      const suspension = id === ids.disable || id === ids.enable;
      return defineAction({
        id,
        title,
        icon:
          id === ids.retry
            ? RefreshIcon
            : id === ids.cancel
              ? CancelIcon
              : id === ids.resend
                ? SendIcon
                : id === ids.disable
                  ? BlockIcon
                  : id === ids.enable
                    ? UnlockIcon
                    : undefined,
        groups: [
          id === ids.select
            ? organizationGroups.organization
            : id === ids.retry
              ? organizationGroups.toolbar
              : id === ids.cancel || id === ids.resend
                ? organizationGroups.invitation
                : organizationGroups.member,
        ],
        slots: suspension
          ? memberPlacement
          : id === ids.retry
            ? [{ slot: 'organizations.toolbar', input: ({ payload }) => payload }]
            : id === ids.select
              ? [{ slot: 'organizations.organization', input: ({ payload }) => payload }]
              : [{ slot: 'organizations.invitation', input: ({ payload }) => payload }],
        enabled: ({ services }) => {
          const state = organizations(services).getSnapshot();
          return !state.pending && (!administrative || state.canManage);
        },
        visible: ({ input, services }) => {
          const service = organizations(services);
          const state = service.getSnapshot();
          const member = state.members.find((item) => item.id === context(input).memberId);
          const suspensionVisible =
            !suspension ||
            (!!service.capabilities.suspension &&
              member?.id !== state.viewerMemberId &&
              Boolean(member?.disabled) === (id === ids.enable));
          return (
            suspensionVisible &&
            (!administrative ||
              (state.canManage &&
                (!(id === ids.remove || suspension) ||
                  (!!member && !member.role.split(',').includes('owner')))))
          );
        },
        execute: ({ services, input }) => {
          const service = organizations(services);
          if (
            id !== ids.select &&
            id !== ids.retry &&
            context(input).organizationId !== service.getSnapshot().activeId
          )
            throw new Error('The workspace changed.');
          return run(service, input);
        },
        success: false,
      });
    }),
  ];
}
