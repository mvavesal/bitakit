'use client';
import { useEffect, type ReactNode } from 'react';
import { Toast } from '@heroui/react';
import { getService } from '@bitakit/core';
import { useBitaKit, useSetting } from '@bitakit/ui';
import { notificationService } from '../../services/notifications.js';
import type { NotificationPlacement } from '../../appearance.js';

/**
 * Renders the one HeroUI toast region at the `shell.toasts` placement and routes action
 * feedback through `app.services.notifications`, so every notification shares this surface.
 */
export function ShellNotifications({ children }: { children: ReactNode }) {
  const { runtime } = useBitaKit();
  const placement = useSetting('shell.toasts').value as NotificationPlacement;
  useEffect(
    () =>
      runtime.setNotifier((message, kind) => {
        const services = runtime.servicesIfMounted();
        if (!services || !runtime.hasService(notificationService)) return undefined;
        return getService(services, notificationService).show(message, {
          type: kind === 'failure' ? 'error' : 'success',
        });
      }),
    [runtime],
  );
  return (
    <>
      {children}
      <Toast.Provider placement={placement} width={360} />
    </>
  );
}
