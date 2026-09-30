'use client';
import { useTranslation } from '@bitakit/ui';
import { createContext, useContext, useState } from 'react';
import { safeHref, type ActionGroup } from '@bitakit/core';
import {
  ActionButton,
  ActionLink,
  ActionGroupBinding,
  type ActionGroupsViewProps,
} from '@bitakit/ui';
import {  Button  } from '../ui/index.js';
import {  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem  } from '../ui/index.js';
import MoreIcon from 'reicon-react/icons/MoreH';
import {  Tooltip, TooltipProvider, TooltipTrigger, TooltipContent  } from '../ui/index.js';
const Presentation = createContext<{variant:'outline'|'default'|'ghost';iconOnly:boolean}>({variant:'outline',iconOnly:false});
const Menu = createContext(false);
const Size = createContext<'sm'|'default'>('sm');
const Input = createContext<unknown>(undefined);
function GroupView({ groups }: ActionGroupsViewProps) {
  const translateUI = useTranslation();
  const size=useContext(Size);
  const presentation=useContext(Presentation);
  const input = useContext(Input);
  const [error, setError] = useState<string | null>(null);
  const menu = useContext(Menu);
  const items = groups.flatMap(group => group.items);
  const report = (error: unknown) => setError(error instanceof Error ? error.message : translateUI("foundationUI.group_actions.theActionFailed", undefined, "Die Aktion ist fehlgeschlagen."));
  if (menu) return <div className="flex justify-end">
    {items.length > 0 && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={translateUI("foundationUI.group_actions.moreActions", undefined, "Weitere Aktionen")}><MoreIcon aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {items.map(action => safeHref(action.href)
        ? <DropdownMenuItem key={action.id} disabled={action.disabled} asChild><ActionLink action={action.id} as="a">{action.icon && <action.icon aria-hidden="true"/>}{action.title}</ActionLink></DropdownMenuItem>
        : <ActionButton key={action.id} action={action.id} input={input} as={DropdownMenuItem} disabled={action.disabled} onError={report}/>
      )}
    </DropdownMenuContent></DropdownMenu>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      {groups
        .flatMap((group) => group.items)
        .map((action) => {
          const href = safeHref(action.href);
          if (href)
            return action.disabled ? (
              <Button
                key={action.id}
                variant="outline"
                size={size}
                className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
                disabled
              >
                {action.title}
              </Button>
            ) : (
              <Button
                key={action.id}
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
          if (presentation.iconOnly && action.icon) return <TooltipProvider key={action.id}><Tooltip><TooltipTrigger asChild><span className="inline-flex"><ActionButton action={action.id} input={input} as={Button} variant="ghost" size="icon" aria-label={action.title} disabled={action.disabled} onError={report}><></></ActionButton></span></TooltipTrigger><TooltipContent>{action.title}</TooltipContent></Tooltip></TooltipProvider>;
          return (
            <ActionButton
              key={action.id}
              as={Button}
              type="button"
              variant={presentation.variant}
              size={size}
              className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
              action={action.id}
              input={input}
              onError={(error) =>
                setError(error instanceof Error ? error.message : translateUI("foundationUI.group_actions.theActionFailed", undefined, "Die Aktion ist fehlgeschlagen."))
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
export function GroupActions<T>({ group, context, size = 'sm', menu = false, variant = 'outline', iconOnly = false }: { group: ActionGroup<T>; context: T; size?:'sm'|'default'; menu?: boolean; variant?: 'outline'|'default'|'ghost'; iconOnly?: boolean }) {
  return (
    <Presentation.Provider value={{variant,iconOnly}}><Menu.Provider value={menu}><Size.Provider value={size}><Input.Provider value={context}>
      <ActionGroupBinding groups={[group]} context={context} as={GroupView} />
    </Input.Provider></Size.Provider></Menu.Provider></Presentation.Provider>
  );
}
