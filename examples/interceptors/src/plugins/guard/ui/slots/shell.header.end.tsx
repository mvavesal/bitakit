'use client';
import { useServiceState, useSetting } from '@bitakit/ui';
import { Badge } from '@bitakit/ui/components';

// Shell's header shows the mode while it is on, with the number of changes it stopped.
export default function ReadOnlyBadge() {
  const readOnly = useSetting('guard.readOnly').value;
  const blocked = useServiceState('guard.blocked', (state) => state.count, 0);
  if (!readOnly) return null;
  return <Badge variant="destructive">Read-only{blocked ? ` · ${blocked} blocked` : ''}</Badge>;
}
