'use client';
import { Action } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import type { Place } from '../services/live';

/**
 * The live Action in a component slot. It passes its place as input; the Action's `visible`
 * decides whether this is the chosen place, so the slot files contain no rule of their own.
 */
export function LivePlace({ place }: { place: Place }) {
  return (
    <Action id="playground.live.target" input={place}>
      {/* self-start: columns such as the page surface would stretch it to their width. */}
      <Button variant="outline" className="self-start" />
    </Action>
  );
}
