'use client';
import { useEffect } from 'react';
import { Toast, type ToastProviderProps } from '@heroui/react';
import { getService } from '@bitakit/core';
import { notificationService } from '../services/notifications.js';
import { useFoundation } from '@bitakit/ui';
import { useSetting } from '@bitakit/app-preferences';
import type { SelectSetting } from '@bitakit/app-preferences/core';
import type { NotificationPlacement } from '../settings/notifications.js';

/** Native renderer contract; use HeroUI Toast parts to preserve accessibility and dismissal. */
export type NotificationLayout = NonNullable<ToastProviderProps['children']>;

/** Owns one native toast surface; upstream consumers use HeroUI's same public default queue. */
export function ShellNotifications({
  placement,
  layout,
}: {
  placement?: SelectSetting<NotificationPlacement>;
  layout?: NotificationLayout;
}) {
  const { runtime } = useFoundation();
  useEffect(
    () =>
      runtime.setNotifier((message, kind) =>
        getService(runtime.services, notificationService).show(message, {
          type: kind === 'failure' ? 'error' : 'success',
        }),
      ),
    [runtime],
  );
  return placement ? <NotificationSurface placement={placement} layout={layout} /> : null;
}

function NotificationSurface({ placement, layout }: { placement: SelectSetting<NotificationPlacement>; layout?: NotificationLayout }) {
  const state = useSetting(placement);
  return <Toast.Provider placement={state.value} width={360}>{layout}</Toast.Provider>;
}
