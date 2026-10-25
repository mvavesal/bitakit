import BoltIcon from 'reicon-react/icons/Bolt';
import SettingsIcon from 'reicon-react/icons/Settings';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import MessageIcon from 'reicon-react/icons/Message';
import PaletteIcon from 'reicon-react/icons/Palette';
import CodeIcon from 'reicon-react/icons/Code';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@bitakit/ui/components';

import { CardSpotlight } from '@/components/ui/card-spotlight';
import { BorderBeam } from '@/components/ui/border-beam';

const capabilities = [
  {
    icon: BoltIcon,
    title: 'Actions',
    text: 'One Action. Every control in sync.',
    example: 'defineAction({ … })',
  },
  {
    icon: PuzzleIcon,
    title: 'Slots',
    text: 'Add to a page without editing it.',
    example: '<PluginSlot name="dashboard.widgets" />',
  },
  {
    icon: SettingsIcon,
    title: 'Settings',
    text: 'Declare a preference. App Preferences builds its page.',
    example: 'defineSettings({ … })',
  },
  {
    icon: MessageIcon,
    title: 'Events',
    text: 'Let features talk through typed events.',
    example: 'pipeline.won → activity feed',
  },
  {
    icon: PaletteIcon,
    title: 'Themes & layouts',
    text: 'Change the look of every plugin at once.',
    example: 'One theme. Every plugin.',
  },
  {
    icon: CodeIcon,
    title: 'Typed discovery',
    text: 'Your files become IDs your editor knows.',
    example: 'Define → discover → bind',
  },
];

export function Foundation() {
  return (
    <div className="capability-grid">
      {capabilities.map(({ icon: Icon, title, text, example }, index) => (
        <CardSpotlight key={title}>
          <CardHeader>
            <Icon aria-hidden="true" className="capability-icon" />
            <CardTitle>{title}</CardTitle>
            <CardDescription>{text}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="capability-example">{example}</p>
          </CardContent>
          <BorderBeam delay={index * 3} />
        </CardSpotlight>
      ))}
    </div>
  );
}
