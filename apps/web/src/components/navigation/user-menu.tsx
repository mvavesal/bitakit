'use client';
import { useTranslations } from 'next-intl';

import { type ReactElement, type ComponentProps } from 'react';
import { ActionMenu } from './action-menu';
import { actionGroups } from '@/lib/action-groups';
import { authClient } from '@/lib/auth-client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserIcon from 'reicon-react/icons/User';
import { Button } from '@/components/ui/button';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';

export function UserMenu({
  email,
  trigger,
  side,
}: {
  email?: string;
  trigger?: ReactElement;
  side?: ComponentProps<typeof DropdownMenuContent>['side'];
}) {
  const t = useTranslations('Nav');
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const userEmail = user?.email ?? email;
  const displayName = user?.name || userEmail?.split('@')[0];
  const initials = displayName
    ?.split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <ActionMenu
      groups={[actionGroups.preferences, actionGroups.account]}
      side={side}
      trigger={
        trigger ?? (
          <Button variant="ghost" size="icon" aria-label={t('userMenu')}>
            <UserIcon aria-hidden="true" />
          </Button>
        )
      }
      header={
        userEmail && (
          <div className="flex items-center gap-2 font-normal">
            <Avatar>
              {user?.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
            </div>
          </div>
        )
      }
    />
  );
}
