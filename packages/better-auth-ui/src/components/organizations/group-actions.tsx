'use client';
import { useTranslation } from '@bitakit/ui';
import { createContext, useContext, useState } from 'react';
import { safeHref, type SlotPayload } from '@bitakit/core';
import { Action, ActionButton, ActionLink, useSlot, type ActionControl } from '@bitakit/ui';
import { Button } from '../ui/index.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/index.js';
import type { OrganizationActionSlot } from '../../slots.js';
import MoreIcon from 'reicon-react/icons/MoreH';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/index.js';
const Presentation = createContext<{
  variant: 'outline' | 'default' | 'ghost' | 'destructive';
  iconOnly: boolean;
}>({ variant: 'outline', iconOnly: false });
const Menu = createContext(false);
const Size = createContext<'sm' | 'default'>('sm');
function GroupView({ items }: { items: readonly (ActionControl & { key?: string })[] }) {
  const translateUI = useTranslation();
  const size = useContext(Size);
  const presentation = useContext(Presentation);
  const [error, setError] = useState<string | null>(null);
  const menu = useContext(Menu);
  const report = (error: unknown) =>
    setError(
      error instanceof Error
        ? error.message
        : translateUI(
            'foundationUI.group_actions.theActionFailed',
            undefined,
            'The action failed.',
          ),
    );
  if (menu)
    return (
      <div className="flex justify-end">
        {items.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={translateUI(
                  'foundationUI.group_actions.moreActions',
                  undefined,
                  'More actions',
                )}
              >
                <MoreIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {items.map((action) =>
                safeHref(action.href) ? (
                  <DropdownMenuItem
                    key={action.key ?? action.id}
                    disabled={action.disabled}
                    asChild
                  >
                    <ActionLink action={action} as="a">
                      {action.icon && <action.icon aria-hidden="true" />}
                      {action.title}
                    </ActionLink>
                  </DropdownMenuItem>
                ) : (
                  <Action
                    key={action.key ?? action.id}
                    id={action}
                    kind="menuItem"
                    onError={report}
                  >
                    <DropdownMenuItem />
                  </Action>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      {items.map((action) => {
        const href = safeHref(action.href);
        if (href)
          return action.disabled ? (
            <Button
              key={action.key ?? action.id}
              variant="outline"
              size={size}
              className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
              disabled
            >
              {action.title}
            </Button>
          ) : (
            <Button
              key={action.key ?? action.id}
              variant="outline"
              size={size}
              className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
              asChild
            >
              <a href={href} title={action.description}>
                {action.title}
              </a>
            </Button>
          );
        if (presentation.iconOnly && action.icon)
          return (
            <TooltipProvider key={action.key ?? action.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <ActionButton
                      action={action}
                      as={Button}
                      variant="ghost"
                      size="icon"
                      aria-label={action.title}
                      disabled={action.disabled}
                      onError={report}
                    >
                      <></>
                    </ActionButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{action.title}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        return (
          <ActionButton
            key={action.key ?? action.id}
            as={Button}
            type="button"
            variant={presentation.variant}
            size={size}
            className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
            action={action}
            onError={(error) =>
              setError(
                error instanceof Error
                  ? error.message
                  : translateUI(
                      'foundationUI.group_actions.theActionFailed',
                      undefined,
                      'The action failed.',
                    ),
              )
            }
          />
        );
      })}
      {error && (
        <p role="alert" className="w-full break-words text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function SlotActions<Name extends OrganizationActionSlot>({
  slot,
  context,
  size = 'sm',
  menu = false,
  variant = 'outline',
  iconOnly = false,
}: {
  slot: Name;
  context: SlotPayload<Name>;
  size?: 'sm' | 'default';
  menu?: boolean;
  variant?: 'outline' | 'default' | 'ghost' | 'destructive';
  iconOnly?: boolean;
}) {
  const view = useSlot(slot as string, { payload: context });
  if (view.error) throw view.error;
  return (
    <Presentation.Provider value={{ variant, iconOnly }}>
      <Menu.Provider value={menu}>
        <Size.Provider value={size}>
          <GroupView
            items={view.items.flatMap((item) =>
              item.kind === 'action' ? [{ ...item.action, key: item.key }] : [],
            )}
          />
        </Size.Provider>
      </Menu.Provider>
    </Presentation.Provider>
  );
}

/** A row outlet binds every contribution independently to this member. */
export function MemberMenu({ payload }: { payload: SlotPayload<'organizations.member.menu'> }) {
  const view = useSlot('organizations.member.menu', { payload });
  if (view.error) throw view.error;
  return (
    <Menu.Provider value={true}>
      <GroupView items={view.items.map((item) => ({ ...item.action, key: item.key }))} />
    </Menu.Provider>
  );
}
