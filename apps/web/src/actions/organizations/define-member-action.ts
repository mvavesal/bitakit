import type { ActionEnvironment } from '@bitakit/core';
import type { ActionIcon } from '@bitakit/ui/actions';
import { MemberAction, type MemberOperation } from './member-action';

export function defineMemberAction(operation: MemberOperation, label: string, icon: ActionIcon) {
  return ({ translate: t }: ActionEnvironment) =>
    new MemberAction(operation, {
      title: `Organizations.${label}`,
      icon,
      confirmation: ({ member }) => ({
        title: t(`Organizations.${label}`),
        destructive: operation === 'remove',
        description: ['admin', 'member'].includes(operation)
          ? t('Organizations.changeRoleDescription', {
              name: member.name,
              role: t(`Organizations.role_${operation}`),
            })
          : t(
              `Organizations.${operation === 'remove' ? 'removeMemberDescription' : operation === 'disable' ? 'disableMemberDescription' : 'enableMemberDescription'}`,
              { name: member.name },
            ),
      }),
    });
}
