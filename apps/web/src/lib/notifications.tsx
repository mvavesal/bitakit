'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type Message =
  | 'invitationCreated'
  | 'saved'
  | 'saveFailed'
  | 'organizationCreated'
  | 'organizationUpdated'
  | 'organizationDeleted'
  | 'organizationDeleteFailed'
  | 'organizationFailed'
  | 'switchFailed'
  | 'createdNotActive';

function NotificationMessage({ message }: { message: Message }) {
  const t = useTranslations('Notifications');
  return <>{t(message)}</>;
}

// All app operations share one presentation and localized messages.
export const notify = {
  success(message: Message, id?: string) {
    return toast.success(<NotificationMessage message={message} />, { id });
  },
  error(message: Message, id?: string) {
    return toast.error(<NotificationMessage message={message} />, { id, duration: 6000 });
  },
};
