import OwnerIcon from 'reicon-react/icons/Crown';
import AdminIcon from 'reicon-react/icons/ShieldCheck';
import MemberIcon from 'reicon-react/icons/User';
import ActiveIcon from 'reicon-react/icons/CheckCircle';
import DisabledIcon from 'reicon-react/icons/UserBlock';
import PendingIcon from 'reicon-react/icons/Clock';
export function MemberRoleIcon({ role }: { role: string }) {
  const roles = role.split(',');
  const Icon = roles.includes('owner')
    ? OwnerIcon
    : roles.includes('admin')
      ? AdminIcon
      : MemberIcon;
  return <Icon aria-hidden="true" data-icon="inline-start" />;
}
export function MemberStatusIcon({ status }: { status: string }) {
  const Icon =
    status === 'disabled' ? DisabledIcon : status === 'pending' ? PendingIcon : ActiveIcon;
  return <Icon aria-hidden="true" data-icon="inline-start" />;
}
