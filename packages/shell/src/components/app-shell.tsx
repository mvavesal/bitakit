'use client';
import {
  Children,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  type ComponentType,
  type ElementType,
  type ReactNode,
} from 'react';
import { cn } from 'cn';
import type { FoundationRuntime } from '@bitakit/core';
import {
  useCurrentPage,
  useFoundation,
  useFoundationNavigation,
  useNavigation,
  useSetting,
  useSlot,
  useTranslation,
  type ActionControl,
  type SlotEntry,
} from '@bitakit/ui';
import {
  AppBar,
  Button,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  TooltipProvider,
  navigationMenuTriggerStyle,
  useSidebar,
} from '@bitakit/ui/components';
import type { ShellLayout } from '../appearance.js';

export type NavigationItemProps = {
  /** A bound navigation action from `useNavigation`. */
  item: ActionControl;
  /** The action's href matches the current pathname. */
  active: boolean;
  /** `sidebar`: inside `SidebarMenuItem`. `navbar`: inside `NavigationMenuItem`. */
  layout: ShellLayout;
};
export type AppShellSidebarProps = {
  /** Navigation action groups; defaults to the `AppShell` groups, then the Shell option. */
  groups?: readonly string[];
  /** Before the `sidebar.header` slot, for example the brand. */
  header?: ReactNode;
  /** After the `sidebar.footer` slot, for example the account menu. */
  footer?: ReactNode;
};
export type AppShellTopBarProps = {
  groups?: readonly string[];
  /** Navbar layout: the start of the bar. */
  brand?: ReactNode;
  /** Sidebar layout: next to the sidebar trigger, for example the page title. */
  header?: ReactNode;
  /** The end of the bar, after the `app-bar.end` slot. */
  end?: ReactNode;
};
export type AppShellContentProps = {
  children?: ReactNode;
  /** Above the page inside the content area; the sidebar layout puts the top bar here. */
  topBar?: ReactNode;
};
/** Replacements for the default parts. Define the map outside render to keep component identity. */
export type AppShellComponents = {
  Sidebar?: ComponentType<AppShellSidebarProps>;
  TopBar?: ComponentType<AppShellTopBarProps>;
  Content?: ComponentType<AppShellContentProps>;
  NavigationItem?: ComponentType<NavigationItemProps>;
};
export type AppShellProps = {
  children?: ReactNode;
  /** Navigation action groups; defaults to the Shell option `groups` (`['navigation']`). */
  groups?: readonly string[];
  components?: AppShellComponents;
  /** Sidebar header in the sidebar layout, start of the top bar in the navbar layout. */
  brand?: ReactNode;
  /** Sidebar footer in the sidebar layout, end of the top bar in the navbar layout. */
  account?: ReactNode;
  /** Next to the sidebar trigger in the sidebar layout. */
  header?: ReactNode;
};

type NamedLayouts = Readonly<Record<string, ComponentType<{ children?: ReactNode }>>>;
type ShellScope = {
  groups?: readonly string[];
  components: AppShellComponents;
  /** Rendering inside a named page layout: a nested AppShell draws the frame. */
  inLayout: boolean;
};
const noComponents: AppShellComponents = {};
const defaultGroups: readonly string[] = ['navigation'];
const ShellContext = createContext<ShellScope>({ components: noComponents, inLayout: false });

function requireShell(runtime: FoundationRuntime) {
  if (!runtime.settings.has('shell.layout'))
    throw new Error(
      'AppShell needs the Shell plugin. Add @bitakit/shell to the app dependencies so discovery installs it, or add shellPlugin() to the plugins.',
    );
}
/** The navigation layout the user chose: `useSetting('shell.layout').value`. */
export function useShellLayout(): ShellLayout {
  requireShell(useFoundation().runtime);
  return useSetting('shell.layout').value as ShellLayout;
}
function useShellGroups(groups: readonly string[] | undefined): readonly string[] {
  const { runtime } = useFoundation();
  const scope = useContext(ShellContext);
  const explicit = groups ?? scope.groups;
  if (explicit) return explicit;
  requireShell(runtime);
  return runtime.configuration.plugin('shell').get('groups', defaultGroups);
}
const renderSlot = (entries: readonly SlotEntry[]) =>
  entries.map((entry) => createElement(entry.component, { key: entry.key }));

/** One navigation entry: a link for actions with an href, otherwise a button. */
function NavigationItem({ item, active, layout }: NavigationItemProps) {
  const { Link } = useFoundationNavigation();
  const Icon = item.icon;
  const label = (
    <>
      {Icon ? <Icon aria-hidden="true" className="shrink-0" /> : null}
      <span className="truncate">{item.title}</span>
    </>
  );
  let control;
  if (item.href === undefined) control = <button {...item.props()}>{label}</button>;
  else {
    // Internal links use the framework link; external and disabled ones stay anchors.
    const Anchor: ElementType = Link && !item.disabled && !/^https?:/i.test(item.href) ? Link : 'a';
    control = (
      <Anchor {...item.linkProps()} aria-current={active ? 'page' : undefined}>
        {label}
      </Anchor>
    );
  }
  return layout === 'navbar' ? (
    <NavigationMenuLink
      asChild
      active={active}
      className={cn(navigationMenuTriggerStyle(), 'max-w-[calc(100vw-3rem)]')}
    >
      {control}
    </NavigationMenuLink>
  ) : (
    <Button asChild variant={active ? 'secondary' : 'ghost'} className="w-full justify-start">
      {control}
    </Button>
  );
}

/** Vertical navigation with the `sidebar.header` and `sidebar.footer` slots; a drawer on mobile. */
function AppShellSidebar({ groups, header, footer }: AppShellSidebarProps) {
  const t = useTranslation();
  const navigation = useNavigation(useShellGroups(groups));
  const top = useSlot('sidebar.header');
  const bottom = useSlot('sidebar.footer');
  const Item = useContext(ShellContext).components.NavigationItem ?? NavigationItem;
  const { setOpenMobile } = useSidebar();
  // The mobile drawer closes after navigating.
  useEffect(() => setOpenMobile(false), [navigation.pathname, setOpenMobile]);
  const label = t('shell.ui.navigation', undefined, 'Main navigation');
  return (
    <Sidebar
      variant="inset"
      mobileTitle={label}
      mobileDescription={t(
        'shell.ui.navigationDescription',
        undefined,
        'Links to the areas of this app.',
      )}
    >
      {header != null || top.length ? (
        <SidebarHeader>
          {header}
          {renderSlot(top)}
        </SidebarHeader>
      ) : null}
      <SidebarContent>
        {navigation.groups.length ? (
          <nav aria-label={label}>
            {navigation.groups.map((group) => (
              <SidebarGroup key={group.id}>
                <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <Item item={item} active={navigation.isActive(item.href)} layout="sidebar" />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </nav>
        ) : null}
      </SidebarContent>
      {bottom.length || footer != null ? (
        <SidebarFooter>
          {renderSlot(bottom)}
          {footer}
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

/**
 * The app bar. Sidebar layout: sidebar trigger and `header`. Navbar layout: `brand`, the
 * navigation menu and `end`. `AppBar` renders the `app-bar.end` slot in both layouts.
 */
function AppShellTopBar({ groups, brand, header, end }: AppShellTopBarProps) {
  const t = useTranslation();
  const layout = useShellLayout();
  const navigation = useNavigation(useShellGroups(groups));
  const Item = useContext(ShellContext).components.NavigationItem ?? NavigationItem;
  if (layout === 'sidebar')
    return (
      <AppBar
        left={
          <>
            <SidebarTrigger aria-label={t('shell.ui.toggle', undefined, 'Toggle navigation')} />
            {header}
          </>
        }
        right={end}
      />
    );
  // One entry per action, in group order; an action in two groups appears once.
  const items = [
    ...new Map(
      navigation.groups.flatMap((group) => group.items).map((item) => [item.id, item]),
    ).values(),
  ];
  return (
    <AppBar
      left={brand}
      center={
        items.length ? (
          <NavigationMenu
            viewport={false}
            aria-label={t('shell.ui.navigation', undefined, 'Main navigation')}
            className="min-w-0 max-w-full justify-start"
          >
            <NavigationMenuList className="flex-wrap justify-start gap-1">
              {items.map((item) => (
                <NavigationMenuItem key={item.id}>
                  <Item item={item} active={navigation.isActive(item.href)} layout="navbar" />
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        ) : undefined
      }
      right={end}
    />
  );
}

/** The content area: `SidebarInset` with the page width wrapper. */
function AppShellContent({ children, topBar }: AppShellContentProps) {
  return (
    <SidebarInset className="min-w-0">
      {topBar}
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
        {children}
      </div>
    </SidebarInset>
  );
}

const layoutsOf = (runtime: FoundationRuntime) =>
  (runtime.config.ui as { layouts?: NamedLayouts } | undefined)?.layouts;

/**
 * The application frame. Renders the default parts in the layout the user chose, unless the
 * children compose `AppShell.Sidebar`, `AppShell.TopBar` or `AppShell.Content` themselves.
 * Plugin pages with `layout = 'blank'` render bare; a named layout from `src/layouts/<name>.tsx`
 * replaces the frame. Switching layouts keeps the page mounted.
 */
function AppShellRoot({
  children,
  groups,
  components = noComponents,
  brand,
  account,
  header,
}: AppShellProps) {
  const { runtime } = useFoundation();
  const parent = useContext(ShellContext);
  const page = useCurrentPage();
  const layout = useShellLayout();
  const resolved = useShellGroups(groups);
  const scope = useMemo<ShellScope>(
    () => ({ groups: resolved, components, inLayout: false }),
    [resolved, components],
  );
  const name = parent.inLayout ? undefined : page?.layout;
  if (name === 'blank') return <>{children}</>;
  const Named = name ? layoutsOf(runtime)?.[name] : undefined;
  if (Named)
    return (
      <ShellContext.Provider value={{ ...scope, inLayout: true }}>
        <Named>{children}</Named>
      </ShellContext.Provider>
    );
  const SidebarPart = components.Sidebar ?? AppShellSidebar;
  const TopBarPart = components.TopBar ?? AppShellTopBar;
  const ContentPart = components.Content ?? AppShellContent;
  const parts = new Set<unknown>([
    AppShellSidebar,
    AppShellTopBar,
    AppShellContent,
    SidebarPart,
    TopBarPart,
    ContentPart,
  ]);
  const composed = Children.toArray(children).some(
    (child) => isValidElement(child) && parts.has(child.type),
  );
  const navbar = layout === 'navbar';
  const topBar = (
    <TopBarPart
      groups={resolved}
      brand={brand}
      header={header}
      end={navbar ? account : undefined}
    />
  );
  return (
    <ShellContext.Provider value={scope}>
      <TooltipProvider>
        <SidebarProvider data-shell-layout={layout} className={navbar ? 'flex-col' : undefined}>
          {composed ? (
            children
          ) : (
            <>
              {navbar ? topBar : <SidebarPart groups={resolved} header={brand} footer={account} />}
              <ContentPart topBar={navbar ? undefined : topBar}>{children}</ContentPart>
            </>
          )}
        </SidebarProvider>
      </TooltipProvider>
    </ShellContext.Provider>
  );
}

/** The application frame with its parts: `AppShell.Sidebar`, `.TopBar`, `.Content`, `.NavigationItem`. */
export const AppShell = Object.assign(AppShellRoot, {
  Sidebar: AppShellSidebar,
  TopBar: AppShellTopBar,
  Content: AppShellContent,
  NavigationItem,
});
