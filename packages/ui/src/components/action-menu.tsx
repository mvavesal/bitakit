'use client';
import { ActionGroupBinding } from '@bitakit/ui/actions';
import { useFoundation } from '../providers/foundation-context.js';
export function ActionMenu({ group, label }: { group: string; label: string }) {
  const { runtime, ui } = useFoundation();
  const target = runtime.getGroup(group);
  return (
    <ActionGroupBinding
      groups={[target]}
      context={undefined}
      as={(props) => <ui.Menu {...props} label={label} />}
    />
  );
}
