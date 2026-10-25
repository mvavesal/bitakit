import type { ComponentType, SVGProps } from 'react';
import PuzzleIcon from 'reicon-react/icons/Puzzle';
import PaletteIcon from 'reicon-react/icons/Palette';
import SidebarIcon from 'reicon-react/icons/Sidebar';
import LanguageIcon from 'reicon-react/icons/Language';
import CodeIcon from 'reicon-react/icons/Code';

export type Topic = {
  id: 'plugins' | 'themes' | 'layout' | 'language' | 'code';
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The topic's explanation in its inspector header. */
  description: string;
};

export const topics: Topic[] = [
  {
    id: 'plugins',
    label: 'Plugins',
    icon: PuzzleIcon,
    description: 'Switch a plugin off; everything it adds leaves.',
  },
  {
    id: 'themes',
    label: 'Themes',
    icon: PaletteIcon,
    description: 'One theme restyles every plugin.',
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: SidebarIcon,
    description: 'Navigation, density and corners are settings.',
  },
  {
    id: 'language',
    label: 'Language',
    icon: LanguageIcon,
    description: 'Every plugin brings its own translations.',
  },
  {
    id: 'code',
    label: 'Code',
    icon: CodeIcon,
    description: 'The real files, one folder per plugin.',
  },
];
