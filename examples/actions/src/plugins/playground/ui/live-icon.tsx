'use client';
import { useServiceState } from '@bitakit/ui';
import BellIcon from 'reicon-react/icons/Bell';
import HeartIcon from 'reicon-react/icons/Heart';
import RocketIcon from 'reicon-react/icons/Rocket';
import StarIcon from 'reicon-react/icons/Star';

export const glyphs = { star: StarIcon, heart: HeartIcon, rocket: RocketIcon, bell: BellIcon };

/**
 * The live Action's icon. An Action's `icon` is a component, not a function of the state, so
 * this component reads the state itself and redraws wherever the Action is shown.
 */
export default function LiveIcon(props: { className?: string; 'aria-hidden'?: boolean | 'true' }) {
  const icon = useServiceState('playground.live', (state) => state.icon, 'star');
  const Glyph = glyphs[icon];
  return <Glyph {...props} />;
}
