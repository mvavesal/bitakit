'use client';
import { useContext, type ReactNode } from 'react';
import { BitaKitContext } from '../providers/foundation-context.js';
import { PluginSlot } from './plugin-slot.js';
import { cn } from 'cn';

export type AppBarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  className?: string;
};

/** Composable application header; product content and navigation are supplied by the consumer. */
export function AppBar({ left, center, right, bottom, className }: AppBarProps) {
  const foundation = useContext(BitaKitContext);
  return (
    <header
      className={cn(
        'shrink-0 wrap-anywhere border-b-(length:--border-width) border-foreground/15 bg-sidebar',
        className,
      )}
    >
      <div className="grid min-h-14 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">{left}</div>
        <div className="order-last col-span-2 min-w-0 empty:hidden lg:order-none lg:col-span-1">
          {center}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-3 lg:col-start-3">
          {foundation && <PluginSlot name="app-bar.end" />}
          {right}
        </div>
      </div>
      {bottom != null && (
        <div className="min-w-0 border-t-(length:--border-width) empty:hidden">{bottom}</div>
      )}
    </header>
  );
}
