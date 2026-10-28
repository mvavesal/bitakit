'use client';
import { Action } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import type { Place } from '../services/live';

const ids = [
  'playground.live.first',
  'playground.live.second',
  'playground.live.third',
  'playground.live.fourth',
] as const;

/**
 * The live Actions for one place, or every added one without a place. Each passes its place as
 * input and the Action's own `visible` decides; empty places render nothing.
 */
export function LiveActions({ place }: { place?: Place }) {
  return (
    <div className="flex flex-wrap gap-2 empty:hidden">
      {ids.map((id) => (
        <Action key={id} id={id} input={place}>
          <Button variant={place ? 'outline' : 'default'} />
        </Action>
      ))}
    </div>
  );
}
