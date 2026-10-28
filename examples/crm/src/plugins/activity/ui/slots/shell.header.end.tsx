'use client';
import { ActionLink, useServiceState } from '@bitakit/ui';
import { Badge } from '@bitakit/ui/components';

// A count in Shell's header; it links to the activity page and hides while nothing happened.
export default function ActivityCount() {
  const count = useServiceState('activity.feed', (state) => state.entries.length, 0);
  if (!count) return null;
  return (
    <ActionLink action="activity.open" aria-label={`${count} new activity entries`}>
      <Badge>{count} new</Badge>
    </ActionLink>
  );
}
