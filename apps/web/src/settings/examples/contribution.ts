import { actionGroups } from '@/actions/groups';
import SettingsIcon from 'reicon-react/icons/Settings';
import { URLAction } from '@bitakit/ui/actions';
import { SettingsSection } from '@bitakit/app-preferences';
import { ExampleSettings } from './example-settings';
export const EXAMPLE_SETTINGS_ID = 'demo.preferences';
export function exampleSettings() {
  return new URLAction({
    id: EXAMPLE_SETTINGS_ID,
    title: 'Example preferences',
    description: 'A temporary local contribution.',
    href: '/settings/example',
    icon: SettingsIcon,
    groups: [actionGroups.navigation, actionGroups.preferences],
    order: 90,
    dividerBefore: true,
  });
}

export function exampleSection() {
  return new SettingsSection({
    id: 'example',
    title: 'Example preferences',
    description: 'A temporary local contribution.',
    icon: SettingsIcon,
    component: ExampleSettings,
    category: { id: 'example', title: 'Example', order: 20 },
  });
}
