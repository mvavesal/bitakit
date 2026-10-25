'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import {
  AppBar,
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@bitakit/ui/components';
import ArrowLeftIcon from 'reicon-react/icons/ArrowLeft';
import SettingsIcon from 'reicon-react/icons/Settings';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlaygroundCommand, PlaygroundState } from '@/playground/protocol';
import { Inspector } from './inspector';
import { topics, type Topic } from './topics';

/** Standalone demo controls use the same inspector and runtime commands as the framed app. */
export function ReturnBar({
  state,
  send,
}: {
  state: PlaygroundState;
  send(command: PlaygroundCommand): void;
}) {
  const t = useTranslations('app.demo');
  const [standalone, setStandalone] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedTopic, setTopic] = useState<Topic['id']>('plugins');
  const topic = topics.find((entry) => entry.id === selectedTopic)?.id ?? 'plugins';
  useEffect(() => setStandalone(window.parent === window), []);
  if (!standalone) return null;
  return (
    <ThemeProvider
      attribute="data-site-theme"
      storageKey="bitakit-site-theme"
      defaultTheme="dark"
      enableColorScheme={false}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <AppBar
          className="site-theme playground-return-bar sticky top-0 z-20 text-foreground"
          left={
            <>
              <Button asChild size="sm" variant="outline">
                <a href="/#playground">
                  <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
                  {t('back')}
                </a>
              </Button>
              <span className="hidden text-sm font-medium sm:inline">{t('label')}</span>
            </>
          }
          right={
            <SheetTrigger asChild data-slot="button">
              <Button size="sm">
                <SettingsIcon aria-hidden="true" data-icon="inline-start" />
                {t('customize')}
              </Button>
            </SheetTrigger>
          }
        />
        <SheetContent className="site-theme" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>{t('customize')}</SheetTitle>
            <SheetDescription>{t('description')}</SheetDescription>
            <Select value={topic} onValueChange={(value) => setTopic(value as Topic['id'])}>
              <SelectTrigger aria-label="Customization topic" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="site-theme">
                <SelectGroup>
                  {topics
                    .filter((entry) => entry.id !== 'code')
                    .map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SheetHeader>
          <div className="flex min-h-0 flex-col px-4 pb-4 [&>[data-slot=card]]:min-h-0">
            <Inspector topic={topic} state={state} send={send} onClose={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </ThemeProvider>
  );
}
