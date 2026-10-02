'use client';
import { useTranslation } from '@bitakit/ui';
import { useFoundationApp } from '@bitakit/ui';
import { Button, Separator } from '@bitakit/ui/components';
import type { shellPlugin } from '../plugin.js';
import ArrowUpIcon from 'reicon-react/icons/ArrowUp';
import ArrowDownIcon from 'reicon-react/icons/ArrowDown';
import ArrowUpLeftIcon from 'reicon-react/icons/ArrowUpLeft';
import ArrowUpRightIcon from 'reicon-react/icons/ArrowUpRight';
import ArrowDownLeftIcon from 'reicon-react/icons/ArrowDownLeft';
import ArrowDownRightIcon from 'reicon-react/icons/ArrowDownRight';
import type { NotificationPlacement } from './notifications.js';
import {
  defineSettingsRenderers,
  CardsControl,
  fieldRenderer,
  sectionRenderer,
  type SelectSetting,
  type SettingControlProps,
  type SettingsSectionRendererProps,
} from '@bitakit/app-preferences';
import { CardFooter } from '../components/ui/card.js';
import { CardAction } from '../components/ui/card.js';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import MonitorIcon from 'reicon-react/icons/Monitor';
import SidebarIcon from 'reicon-react/icons/Sidebar';
import NavbarIcon from 'reicon-react/icons/Window2';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/index.js';
import type { ComponentType, ReactNode } from 'react';
type ChoiceIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
import { themePreferences } from './theme.js';
import { PrimaryColor } from './primary-color.js';
import { shellLayout, shellTheme } from './appearance.js';

/** Shell supplies icons; preference controls own interaction and card composition. */
function choiceCards(icons: Readonly<Record<string, ChoiceIcon>>) {
  return function ShellChoiceCards<V extends string>(props: SettingControlProps<SelectSetting<V>>) {
    return (
      <CardsControl
        {...props}
        setValue={(value) => props.setValue(value as V)}
        options={props.options.map((option) => ({ ...option, icon: icons[option.value] }))}
      />
    );
  };
}
export const ThemeCards = choiceCards({ light: SunIcon, dark: MoonIcon, system: MonitorIcon });
export const NotificationCards = choiceCards({
  bottom: ArrowDownIcon,
  'bottom start': ArrowDownLeftIcon,
  'bottom end': ArrowDownRightIcon,
  top: ArrowUpIcon,
  'top start': ArrowUpLeftIcon,
  'top end': ArrowUpRightIcon,
});
export const LayoutCards = choiceCards({ sidebar: SidebarIcon, navbar: NavbarIcon });

/** One card per field; the ids keep each card title connected to its control. */
export function AppearanceSection({
  items,
  footer,
}: SettingsSectionRendererProps & { footer?: ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      {items.map((item) => (
        <Card key={item.key}>
          <CardHeader>
            <CardTitle id={item.ids.labelId}>{item.labelText}</CardTitle>
            {item.descriptionText && (
              <CardDescription id={item.ids.descriptionId}>{item.descriptionText}</CardDescription>
            )}
            <CardAction>{item.resetControl}</CardAction>
          </CardHeader>
          <CardContent>
            {item.control}
            {item.feedback}
          </CardContent>
          {footer && <CardFooter>{footer}</CardFooter>}
        </Card>
      ))}
    </div>
  );
}
/** Preview uses the same replaceable public service and confirmed placement as real messages. */
function NotificationSection(props: SettingsSectionRendererProps) {
  const t = useTranslation();
  const app = useFoundationApp<readonly [ReturnType<typeof shellPlugin>]>();
  const notifications = app.has('notifications')
    ? (
        app.services as unknown as {
          notifications: { show(message: string, options?: Record<string, unknown>): unknown };
        }
      ).notifications
    : undefined;
  return (
    <AppearanceSection
      {...props}
      footer={
        <div className="flex w-full flex-col items-start gap-4">
          <Separator />
          <CardDescription>
            {t('shell.ui.testHint', undefined, 'Preview a notification at the selected position.')}
          </CardDescription>
          <Button
            type="button"
            variant="secondary"
            disabled={!notifications || props.items.some((item) => item.state?.pending)}
            onClick={() =>
              notifications?.show('shell.ui.testTitle', {
                type: 'info',
                description: 'shell.ui.testDescription',
              })
            }
          >
            {t('shell.ui.testButton', undefined, 'Show test notification')}
          </Button>
        </div>
      }
    />
  );
}

/** Shell renderers: plugin-layer field renderers for its own fields and its appearance layout. */
export function shellRenderers({
  appearance = true,
  theme = shellTheme,
  layout = shellLayout,
  notifications,
}: {
  notifications?: SelectSetting<NotificationPlacement>;
  appearance?: boolean;
  theme?: SelectSetting<'light' | 'dark' | 'system'>;
  layout?: SelectSetting<'sidebar' | 'navbar'>;
} = {}) {
  return defineSettingsRenderers({
    fields: [
      ...(notifications ? [fieldRenderer(notifications, NotificationCards, { group: true })] : []),
      ...(appearance
        ? [
            fieldRenderer(theme, ThemeCards, { group: true }),
            fieldRenderer(themePreferences.fields.primary, PrimaryColor, { group: true }),
          ]
        : []),
      fieldRenderer(layout, LayoutCards, { group: true }),
    ],
    sections: [
      ...(notifications ? [sectionRenderer('shell-notifications', NotificationSection)] : []),
      ...(appearance
        ? [
            sectionRenderer('appearance', AppearanceSection),
            sectionRenderer('shell-theme', AppearanceSection),
          ]
        : []),
    ],
  });
}
