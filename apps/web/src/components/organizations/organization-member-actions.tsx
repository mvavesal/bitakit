'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import MoreIcon from 'reicon-react/icons/MoreH';
import { actionGroups } from '@/lib/action-groups';
import type { MemberActionContext } from '@/lib/organizations/action-context';
import { ActionMenu } from '@/components/navigation/action-menu';
import { Button } from '@/components/ui/button';
export function OrganizationMemberActions({
  organizationId,
  member,
  canManage,
  onRefresh,
}: Omit<MemberActionContext, 'refresh'> & { onRefresh?: () => void }) {
  const t = useTranslations('Organizations');
  const router = useRouter();
  return (
    <ActionMenu
      groups={[actionGroups.member]}
      input={{ organizationId, member, canManage, refresh: onRefresh ?? router.refresh }}
      header={member.name}
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('personActions', { name: member.name })}
        >
          <MoreIcon aria-hidden="true" />
        </Button>
      }
    />
  );
}
