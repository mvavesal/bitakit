'use client';
import { useActionGroups } from '../hooks/use-action-group.js';
import { useBitaKit } from '../providers/foundation-context.js';

/** Shows an action group through the host's menu component. */
export function ActionMenu({
  group,
  label,
  input,
}: {
  group: string | readonly string[];
  label: string;
  input?: unknown;
}) {
  const { ui } = useBitaKit();
  const groups = useActionGroups(typeof group === 'string' ? [group] : group, input);
  const Menu = ui.Menu;
  return <Menu groups={groups} label={label} />;
}
