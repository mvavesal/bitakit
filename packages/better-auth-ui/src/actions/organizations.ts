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
import BuildingIcon from 'reicon-react/icons/Building';
import { OrganizationDialog, ConfirmOrganizationAction } from '../components/organizations/organization-dialog.js';
import { createElement } from 'react';
import { InviteDialog } from '../components/organizations/invite-dialog.js';
import {
  defineAction,
  defineDialogAction,
  defineURLAction,
  getService,
  type Contribution,
} from '@bitakit/core';
import { organizationService } from '@bitakit/organizations';
import { organizationGroups } from '@bitakit/organizations';
import type { OrganizationService } from '@bitakit/organizations';
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
export function organizationActions(options: {
  path?: string | false;
  groups?: readonly string[];
}): Contribution[] {
  return [
    ...(['accept', 'reject'] as const).map((operation) =>
      defineAction({
        id: `organizations.${operation}`,
        title: operation === 'accept' ? 'Annehmen' : 'Ablehnen',
        icon: operation === 'accept' ? AcceptIcon : CancelIcon,
        groups: [organizationGroups.incoming],
        watch: [organizationService],
        resolve: (input, { services }) => {
          const service = getService(services, organizationService);
          const state = service.getSnapshot();
          return {
            enabled: !state.pending,
            visible:
              service.capabilities.invitations &&
              !!state.incomingInvitations?.some(
                (item) => item.id === context(input).invitationId && item.status === 'pending',
              ),
          };
        },
        execute: ({ services, input }) =>
          getService(services, organizationService)[operation](context(input).invitationId ?? ''),
        success: operation === 'accept' ? 'Einladung angenommen.' : 'Einladung abgelehnt.',
      }),
    ),
    ...(options.path === false ? [] : [defineURLAction({
      id: ids.page,
      title: 'Organisationen',
      href: options.path ?? '/organizations',
      groups: options.groups ?? ['navigation'],
    })]),
    defineDialogAction({
      id:ids.create,groups:[],title:'Organisation erstellen',
      render:({services,close})=>createElement(OrganizationDialog,{service:getService(services,organizationService),close}),
    }),
    defineDialogAction({id:'organizations.edit',title:'Organisation bearbeiten',groups:[organizationGroups.management],render:({services,input,close})=>createElement(OrganizationDialog,{service:getService(services,organizationService),organizationId:context(input).organizationId,close})}),
    defineDialogAction({id:'organizations.delete',title:'Organisation löschen',groups:[organizationGroups.danger],render:({services,input,close})=>createElement(ConfirmOrganizationAction,{service:getService(services,organizationService),organizationId:context(input).organizationId??null,close})}),
    defineDialogAction({id:ids.remove,icon:RemoveIcon,title:'Entfernen',groups:[organizationGroups.member],watch:[organizationService],resolve:(input,{services})=>{const state=getService(services,organizationService).getSnapshot();const member=state.members.find((item)=>item.id===context(input).memberId);return {enabled:!state.pending,visible:state.canManage && !!member && !member.role.split(',').includes('owner')};},render:({services,input,close})=>createElement(ConfirmOrganizationAction,{service:getService(services,organizationService),organizationId:context(input).organizationId??null,memberId:context(input).memberId,close})}),
    ...(['admin', 'member'] as const).map((targetRole) => defineDialogAction({
      id: `organizations.${targetRole === 'admin' ? 'promote' : 'demote'}`,
      title: targetRole === 'admin' ? 'Zum Administrator machen' : 'Zum Mitglied machen',
      icon: targetRole === 'admin' ? RoleIcon : DemoteIcon,
      groups: [organizationGroups.member],
      watch: [organizationService],
      resolve: (input, { services }) => {
        const state = getService(services, organizationService).getSnapshot();
        const member = state.members.find(item => item.id === context(input).memberId);
        return {
          enabled: !state.pending,
          visible: state.canManage && member?.role === (targetRole === 'admin' ? 'member' : 'admin'),
        };
      },
      render: ({ services, input, close }) => createElement(ConfirmOrganizationAction, {
        service: getService(services, organizationService),
        organizationId: context(input).organizationId ?? null,
        memberId: context(input).memberId,
        targetRole,
        close,
      }),
    })),
    defineDialogAction({
      id: ids.invite,
      size: 'wide',
      groups: [organizationGroups.members],
      title: 'Mitglied einladen',
      icon: UserAddIcon,
      render: ({ services, input, close }) =>
        createElement(InviteDialog, {
          service: getService(services, organizationService),
          organizationId: context(input).organizationId ?? null,
          close,
        }),
    }),
    ...(
      [
        [
          ids.select,
          'Wechseln',
          (service, input) => service.setActive(context(input).organizationId ?? ''),
        ],
        [ids.retry, 'Aktualisieren', (service) => service.refresh()],
        [
          ids.cancel,
          'Zurückziehen',
          (service, input) => service.cancel(context(input).invitationId ?? ''),
        ],
        [
          ids.resend,
          'Erneut senden',
          (service, input) => service.resend(context(input).invitationId ?? ''),
        ],
        [
          ids.disable,
          'Sperren',
          (service, input) => service.setDisabled(context(input).memberId ?? '', true),
        ],
        [
          ids.enable,
          'Entsperren',
          (service, input) => service.setDisabled(context(input).memberId ?? '', false),
        ],
      ] satisfies [
        string,
        string,
        (service: OrganizationService, input: unknown) => Promise<void>,
      ][]
    ).map(([id, title, run]) =>
      defineAction({
        id,
        title,
        icon: id === ids.retry ? RefreshIcon : id === ids.cancel ? CancelIcon : id === ids.resend ? SendIcon : id === ids.disable ? BlockIcon : id === ids.enable ? UnlockIcon : undefined,
        groups: [
          id === ids.select
            ? organizationGroups.organization
            : id === ids.retry
              ? organizationGroups.toolbar
              : id === ids.cancel || id === ids.resend
                ? organizationGroups.invitation
                : organizationGroups.member,
        ],
        watch: [organizationService],
        resolve: (input, { services }) => {
          const state = getService(services, organizationService).getSnapshot();
          const row = context(input);
          const member = state.members.find((item) => item.id === row.memberId);
          const administrative = id !== ids.select && id !== ids.retry;
          const suspension = id === ids.disable || id === ids.enable;
          const suspensionVisible =
            !suspension ||
            (getService(services, organizationService).capabilities.suspension &&
              member?.id !== state.viewerMemberId &&
              Boolean(member?.disabled) === (id === ids.enable));
          return {
            enabled: !state.pending && (!administrative || state.canManage),
            visible:
              suspensionVisible &&
              (!administrative ||
                (state.canManage &&
                  (!(id === ids.remove || suspension) ||
                    (!!member && !member.role.split(',').includes('owner'))))),
          };
        },
        execute: ({ services, input }) => {
          const service = getService(services, organizationService);
          if (
            id !== ids.select &&
            id !== ids.retry &&
            context(input).organizationId !== service.getSnapshot().activeId
          )
            throw new Error('Der Arbeitsbereich wurde geändert.');
          return run(service, input);
        },
        success: false,
      }),
    ),
  ];
}
