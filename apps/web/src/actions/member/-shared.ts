import { defineAction, getService, translationService } from '@bitakit/core';
import type { ActionIcon } from '@bitakit/core/actions';
import { authClient } from '@/lib/auth-client';
import { actionGroups } from '@/lib/action-groups';
import type { MemberActionContext } from '@/lib/organizations/action-context';

export type MemberOperation = 'admin' | 'member' | 'disable' | 'enable' | 'remove';

function applies(operation: MemberOperation, member: MemberActionContext['member']) {
  const roles = member.role.split(',');
  const elevated = roles.some((role) => role === 'admin' || role === 'owner');
  if (operation === 'admin') return !elevated;
  if (operation === 'member') return elevated;
  if (operation === 'enable') return !roles.includes('owner') && member.disabled;
  if (operation === 'disable') return !roles.includes('owner') && !member.disabled;
  return true;
}

async function run(operation: MemberOperation, { organizationId, member }: MemberActionContext) {
  if (operation === 'disable' || operation === 'enable') {
    const response = await fetch('/api/organizations/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        memberId: member.id,
        disabled: operation === 'disable',
      }),
    });
    if (!response.ok) throw new Error('Member update failed');
    return;
  }
  const result =
    operation === 'remove'
      ? await authClient.organization.removeMember({ organizationId, memberIdOrEmail: member.id })
      : await authClient.organization.updateMemberRole({
          organizationId,
          memberId: member.id,
          role: operation,
        });
  if (result.error) throw new Error('Member update failed');
}

const descriptions: Record<MemberOperation, string> = {
  admin: 'changeRoleDescription',
  member: 'changeRoleDescription',
  remove: 'removeMemberDescription',
  disable: 'disableMemberDescription',
  enable: 'enableMemberDescription',
};

/** One behavior per operation, registered once and bound to every member row through its input. */
export function memberAction(operation: MemberOperation, label: string, icon: ActionIcon) {
  const destructive = operation === 'remove';
  return defineAction<MemberActionContext>({
    title: `Organizations.${label}`,
    icon,
    groups: [actionGroups.member],
    order: destructive ? 100 : 10,
    dividerBefore: destructive,
    variant: destructive ? 'destructive' : 'default',
    visible: ({ input }) => !!input?.member && applies(operation, input.member),
    enabled: ({ input }) => !!input?.canManage,
    confirm: ({ input, services }) => {
      if (!input?.member) return false;
      const t = getService(services, translationService).translate;
      const values: Record<string, string> = { name: input.member.name };
      if (operation === 'admin' || operation === 'member')
        values.role = t(`Organizations.role_${operation}`);
      return {
        title: t(`Organizations.${label}`),
        description: t(`Organizations.${descriptions[operation]}`, values),
        destructive,
      };
    },
    execute: async ({ input }) => {
      await run(operation, input);
      input.refresh();
    },
    success: 'Notifications.saved',
    failure: 'Notifications.saveFailed',
  });
}
