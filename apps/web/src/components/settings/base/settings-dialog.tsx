'use client';

import { useTranslations } from 'next-intl';

import { useSettingsSections } from '@bitakit/app-preferences';
import { useRef, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import XIcon from 'reicon-react/icons/Xmark';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SettingsShell } from './settings-shell';
import { SettingsDialogContext } from '@/components/settings/base/settings-link';

// Only mounted by the workspace's intercepted route after internal navigation.
// Direct loads use /settings and its explicit internal fallback instead.
export function SettingsDialog({ children }: { children: ReactNode }) {
  const t = useTranslations('Settings');
  const router = useRouter();
  const pathname = usePathname();
  const scope = useSettingsSections().find(
    (section) => `/settings/${section.path}` === pathname,
  )?.scope;
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <SettingsDialogContext.Provider value={true}>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) router.back();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(48rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(72rem,calc(100vw-4rem))]"
          onEscapeKeyDown={(event) => {
            // The portaled mobile drawer handles its own Escape. Its layer can
            // still be settling after navigation or a locale refresh.
            if (event.target instanceof Element && event.target.closest('[data-mobile="true"]'))
              event.preventDefault();
          }}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const previous = returnFocus.current;
            if (
              previous?.isConnected &&
              previous.tabIndex >= 0 &&
              !previous.closest('[data-mobile="true"]') &&
              previous.getClientRects().length
            )
              previous.focus({ preventScroll: true });
            else
              document
                .querySelector<HTMLElement>('[data-slot="sidebar-trigger"]')
                ?.focus({ preventScroll: true });
          }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 md:px-8 md:py-5">
            <div className="flex flex-col gap-1">
              <DialogTitle>{scope?.title ?? t('title')}</DialogTitle>
              <DialogDescription className={scope ? 'sr-only' : undefined}>
                {scope?.title ?? t('browser')}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label={t('close')}>
                  <XIcon aria-hidden="true" />
                </Button>
              </DialogClose>
            </div>
          </header>
          <SettingsShell embedded>{children}</SettingsShell>
        </DialogContent>
      </Dialog>
    </SettingsDialogContext.Provider>
  );
}
