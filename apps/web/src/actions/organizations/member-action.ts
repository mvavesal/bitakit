import { actionGroups } from '../groups';
import { Action } from '@bitakit/ui/actions';
import type { ActionIcon } from '@bitakit/ui/actions';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/notifications';
import type { MemberActionContext } from './context';
import type { Confirmation } from '@bitakit/core';

export type MemberOperation = 'admin' | 'member' | 'disable' | 'enable' | 'remove';
/** One behavior per instance, registered once for all member rows. */
export class MemberAction extends Action<MemberActionContext> {
  constructor(
    private operation: MemberOperation,
    options: {
      title: string;
      icon: ActionIcon;
      confirmation: (context: MemberActionContext) => Confirmation;
    },
  ) {
    super({
      id: `member.${operation}`,
      title: options.title,
      groups: [actionGroups.member],
      order: operation === 'remove' ? 100 : 10,
      dividerBefore: operation === 'remove',
      icon: options.icon,
      variant: operation === 'remove' ? 'destructive' : 'default',
      metadata: { confirmation: options.confirmation },
    });
  }
  isVisible(context: MemberActionContext) {
    if (!context?.member) return false;
    const { role, disabled } = context.member;
    const roles = role.split(',');
    if (this.operation === 'admin')
      return !roles.some((role) => role === 'admin' || role === 'owner');
    if (this.operation === 'member')
      return roles.some((role) => role === 'admin' || role === 'owner');
    if (this.operation === 'enable') return !roles.includes('owner') && disabled;
    if (this.operation === 'disable') return !roles.includes('owner') && !disabled;
    return true;
  }
  isEnabled(context: MemberActionContext) {
    return !!context?.canManage;
  }
  async execute({ organizationId, member, refresh }: MemberActionContext) {
    if (this.operation === 'disable' || this.operation === 'enable') {
      const response = await fetch('/api/organizations/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          memberId: member.id,
          disabled: this.operation === 'disable',
        }),
      });
      if (!response.ok) throw new Error('Member update failed');
    } else {
      const result =
        this.operation === 'remove'
          ? await authClient.organization.removeMember({
              organizationId,
              memberIdOrEmail: member.id,
            })
          : await authClient.organization.updateMemberRole({
              organizationId,
              memberId: member.id,
              role: this.operation,
            });
      if (result.error) throw new Error('Member update failed');
    }
    notify.success('saved');
    refresh();
  }
}
