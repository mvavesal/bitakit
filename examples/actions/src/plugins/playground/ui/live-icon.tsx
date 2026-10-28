'use client';
import { useServiceState } from '@bitakit/ui';
import BellIcon from 'reicon-react/icons/Bell';
import HeartIcon from 'reicon-react/icons/Heart';
import RocketIcon from 'reicon-react/icons/Rocket';
import StarIcon from 'reicon-react/icons/Star';
import type { Icon } from '../services/live';

/** The glyph for each icon name the live Action can show. */
export const glyphs = {
  star: StarIcon,
  heart: HeartIcon,
  rocket: RocketIcon,
  bell: BellIcon,
} satisfies Record<Icon, unknown>;

/**
 * The live Action's icon. An Action's `icon` is a component, not a function of the state, so
 * this component reads the state itself: every place that shows the Action redraws it. During
 * a spotlight it bounces, so each place shows where the Action is.
 */
export default function LiveIcon(props: { className?: string; 'aria-hidden'?: boolean | 'true' }) {
  const icon = useServiceState('playground.live', (state) => state.icon, 'star');
  const spotlight = useServiceState('playground.live', (state) => state.spotlight, false);
  const Glyph = glyphs[icon];
  return (
    <Glyph
      {...props}
      className={spotlight ? `${props.className ?? ''} animate-bounce` : props.className}
    />
  );
}
