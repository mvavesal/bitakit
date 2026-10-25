'use client';
import { useServiceState, useTranslation } from '@bitakit/ui';
import { Badge } from '@bitakit/ui/components';

// A widget in Shell's header, from the same plugin.
export default function ActivityCount() {
  const t = useTranslation();
  const count = useServiceState('activity.feed', (state) => state.entries.length, 0);
  if (!count) return null;
  return <Badge variant="secondary">{t('activity.header', { count }, `${count} new`)}</Badge>;
}
