'use client';
import { useEffect, useRef } from 'react';
import type { BitaKitRuntime } from '@bitakit/core';

/** Actions can open a dialog without a DialogTrigger, including from a transient menu. */
export function useDialogFocus(runtime: BitaKitRuntime) {
  const target = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let wasOpen = false;
    return runtime.subscribe(() => {
      const open = runtime.getSnapshot() !== null;
      if (open && !wasOpen) {
        const active = document.activeElement as HTMLElement | null;
        const menu = active?.closest('[role="menu"]');
        const trigger = menu?.id
          ? Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]')).find(
              (element) => element.getAttribute('aria-controls') === menu.id,
            )
          : undefined;
        target.current = trigger ?? active;
      }
      wasOpen = open;
    });
  }, [runtime]);
  return (event: { preventDefault(): void }) => {
    if (target.current?.isConnected) {
      event.preventDefault();
      target.current.focus();
    }
  };
}
