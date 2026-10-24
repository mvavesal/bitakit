'use client';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  type ComponentType,
  type ElementType,
  type ReactNode,
} from 'react';
import { cn } from 'cn';
import type { BitaKitRuntime } from '@bitakit/core';
import {
  useCurrentPage,
  useBitaKit,
  useBitaKitNavigation,
  useNavigation,
  useSetting,
  useSlot,
  PluginSlot,
  useTranslation,
  type ActionControl,
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
import {
  renderRegion,
  ShellSurface,
  ShellFullPage,
  ShellAuthLayout,
  ShellErrorLayout,
  ShellFooter,
  ShellHeaderRow,
  ShellDrawer,
  type ShellSurfaceProps,
} from './regions.js';
import type { ShellLayout } from '../appearance.js';
import { ShellToolbar } from './toolbar.js';

export type NavigationItemProps = {
  /** A bound navigation action from `useNavigation`. */
  item: ActionControl;
  /** The action's href matches the current pathname. */
  active: boolean;
  /** `sidebar`: inside `SidebarMenuItem`. `navbar`: inside `NavigationMenuItem`. */
  layout: ShellLayout;
};
export type AppShellSidebarProps = {
  /** Explicit Action slot; defaults to AppShell, then the Shell option. */
  navigationSlot?: string;
  /** Before the `sidebar.header` slot, for example the brand. */
  header?: ReactNode;
  /** After the `sidebar.footer` slot, for example the account menu. */
  footer?: ReactNode;
};
export type AppShellTopBarProps = {
  navigationSlot?: string;
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
  Surface?: ComponentType<ShellSurfaceProps>;
  Footer?: ComponentType<ShellSurfaceProps>;
  NavigationItem?: ComponentType<NavigationItemProps>;
};
export type AppShellProps = {
  children?: ReactNode;
  /** Explicit Action slot; defaults to the Shell option navigationSlot. */
  navigationSlot?: string;
  components?: AppShellComponents;
  /** Sidebar header in the sidebar layout, start of the top bar in the navbar layout. */
  brand?: ReactNode;
  /** Sidebar footer in the sidebar layout, end of the top bar in the navbar layout. */
  account?: ReactNode;
  /** Next to the sidebar trigger in the sidebar layout. */
  header?: ReactNode;
  /**
   * The layout family instead of the current page's `export const layout`, for routes outside
   * plugin pages such as the framework's not-found and error files: `'error'`, `'auth'`, ...
   */
  layout?: string;
};

type NamedLayouts = Readonly<Record<string, ComponentType<{ children?: ReactNode }>>>;
type ShellScope = {
  navigationSlot?: string;
  components: AppShellComponents;
  /** Rendering inside a named page layout: a nested AppShell draws the frame. */
  inLayout: boolean;
};
const noComponents: AppShellComponents = {};
const defaultSlot = 'shell.navigation';
const ShellContext = createContext<ShellScope>({ components: noComponents, inLayout: false });

function requireShell(runtime: BitaKitRuntime) {
  if (!runtime.settings.has('shell.layout'))
    throw new Error(
      'AppShell needs the Shell plugin. Add @bitakit/shell to the app dependencies so discovery installs it, or add shellPlugin() to the plugins.',
    );
}
/** The navigation layout the user chose: `useSetting('shell.layout').value`. */
export function useShellLayout(): ShellLayout {
  requireShell(useBitaKit().runtime);
  return useSetting('shell.layout').value as ShellLayout;
}
function useShellNavigationSlot(slot: string | undefined): string {
  const { runtime } = useBitaKit();
  const scope = useContext(ShellContext);
  const explicit = slot ?? scope.navigationSlot;
  if (explicit) return explicit;
  requireShell(runtime);
  return runtime.configuration.plugin('shell').get('navigationSlot', defaultSlot);
}
/** One navigation entry: a link for actions with an href, otherwise a button. */
function NavigationItem({ item, active, layout }: NavigationItemProps) {
  const { Link } = useBitaKitNavigation();
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

/** One explicit navigation group; its Action slot still owns placement. */
function AppShellNavigationGroup({
  id,
  title,
  navigationSlot,
}: {
  id: string;
  title: ReactNode;
  navigationSlot: string;
}) {
  const navigation = useNavigation(navigationSlot);
  const Item = useContext(ShellContext).components.NavigationItem ?? NavigationItem;
  if (navigation.error) throw navigation.error;
  if (!navigation.items.length) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <PluginSlot name="shell.navigation.group.before" payload={{ groupId: id }} />
      <SidebarMenu>
        {navigation.items.map((item) => (
          <SidebarMenuItem key={item.key}>
            <Item item={item} active={navigation.isActive(item.href)} layout="sidebar" />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <PluginSlot name="shell.navigation.group.after" payload={{ groupId: id }} />
    </SidebarGroup>
  );
}

/** Vertical navigation with the `sidebar.header` and `sidebar.footer` slots; a drawer on mobile. */
function AppShellSidebar({ navigationSlot, header, footer }: AppShellSidebarProps) {
  const t = useTranslation();
  const navigation = useNavigation(useShellNavigationSlot(navigationSlot));
  const { state } = useSidebar();
  const payload = { collapsed: state === 'collapsed' };
  const top = useSlot('sidebar.header', { payload });
  const bottom = useSlot('sidebar.footer', { payload });
  const brand = useSlot('shell.brand');
  const Item = useContext(ShellContext).components.NavigationItem ?? NavigationItem;
  const { setOpenMobile } = useSidebar();
  // The mobile drawer closes after navigating.
  useEffect(() => setOpenMobile(false), [navigation.pathname, setOpenMobile]);
  const label = t('shell.ui.navigation', undefined, 'Main navigation');
  if (navigation.error) throw navigation.error;
  if (top.error) throw top.error;
  if (bottom.error) throw bottom.error;
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
      {header != null || top.items.length || brand.items.length ? (
        <SidebarHeader>
          {header}
          <PluginSlot name="shell.brand" />
          {renderRegion('sidebar.header', top)}
        </SidebarHeader>
      ) : null}
      <SidebarContent>
        {navigation.items.length ? (
          <nav aria-label={label}>
            <SidebarGroup>
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <PluginSlot name="shell.navigation.group.before" payload={{ groupId: 'main' }} />
              <SidebarMenu>
                {navigation.items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <Item item={item} active={navigation.isActive(item.href)} layout="sidebar" />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              <PluginSlot name="shell.navigation.group.after" payload={{ groupId: 'main' }} />
            </SidebarGroup>
          </nav>
        ) : null}
        <PluginSlot name="sidebar.body" payload={payload} />
      </SidebarContent>
      {bottom.items.length || footer != null ? (
        <SidebarFooter>
          {renderRegion('sidebar.footer', bottom)}
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
function AppShellTopBar({ navigationSlot, brand, header, end }: AppShellTopBarProps) {
  const t = useTranslation();
  const layout = useShellLayout();
  const navigation = useNavigation(useShellNavigationSlot(navigationSlot));
  const Item = useContext(ShellContext).components.NavigationItem ?? NavigationItem;
  if (navigation.error) throw navigation.error;
  if (layout === 'sidebar')
    return (
      <AppBar
        left={
          <>
            <SidebarTrigger aria-label={t('shell.ui.toggle', undefined, 'Toggle navigation')} />
            <PluginSlot name="shell.header.start" />
            {header}
          </>
        }
        center={<PluginSlot name="shell.header.center" />}
        right={
          <>
            <ShellToolbar />
            <PluginSlot name="shell.header.end" />
            {end}
          </>
        }
        bottom={<PluginSlot name="shell.header.rows" />}
      />
    );
  const items = navigation.items;
  return (
    <AppBar
      left={
        <>
          {brand}
          <PluginSlot name="shell.brand" />
          <PluginSlot name="shell.header.start" />
        </>
      }
      center={
        <>
          <PluginSlot name="shell.header.center" />
          {items.length ? (
            <NavigationMenu
              viewport={false}
              aria-label={t('shell.ui.navigation', undefined, 'Main navigation')}
              className="min-w-0 max-w-full justify-start"
            >
              <NavigationMenuList className="flex-wrap justify-start gap-1">
                {items.map((item) => (
                  <NavigationMenuItem key={item.key}>
                    <Item item={item} active={navigation.isActive(item.href)} layout="navbar" />
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          ) : null}
        </>
      }
      right={
        <>
          <ShellToolbar />
          <PluginSlot name="shell.header.end" />
          {end}
        </>
      }
      bottom={<PluginSlot name="shell.header.rows" />}
    />
  );
}

/** The content area: `SidebarInset` with the page width wrapper. */
function AppShellContent({ children, topBar }: AppShellContentProps) {
  const Surface = useContext(ShellContext).components.Surface ?? ShellSurface;
  const Footer = useContext(ShellContext).components.Footer ?? ShellFooter;
  return (
    <SidebarInset className="min-w-0">
      {topBar}
      <Surface>{children}</Surface>
      <Footer />
    </SidebarInset>
  );
}

const layoutsOf = (runtime: BitaKitRuntime) =>
  (runtime.config.ui as { layouts?: NamedLayouts } | undefined)?.layouts;

/** Shell's default for each family it declares; other families fall back to the app frame. */
const defaultLayouts: Readonly<Record<string, ComponentType<{ children?: ReactNode }>>> = {
  auth: ShellAuthLayout,
  error: ShellErrorLayout,
  'full-page': ShellFullPage,
};

/**
 * The application frame. Renders the default parts in the layout the user chose, unless the
 * children compose `AppShell.Sidebar`, `AppShell.TopBar` or `AppShell.Content` themselves, or a
 * `layout.app` contribution replaces the frame. Plugin pages with `layout = 'blank'` render bare;
 * another family renders its `layout.<family>` contribution (`src/layouts/<family>.tsx` or a
 * plugin's `ui/layouts/...`) or Shell's default. Switching layouts keeps the page mounted.
 */
function AppShellRoot({
  children,
  navigationSlot,
  components = noComponents,
  brand,
  account,
  header,
  layout: family,
}: AppShellProps) {
  const { runtime } = useBitaKit();
  const parent = useContext(ShellContext);
  const page = useCurrentPage();
  const layout = useShellLayout();
  const resolved = useShellNavigationSlot(navigationSlot);
  const scope = useMemo<ShellScope>(
    () => ({ navigationSlot: resolved, components, inLayout: false }),
    [resolved, components],
  );
  const replaced = useSlot('layout.app').items.length > 0;
  const name = family ?? (parent.inLayout ? undefined : page?.layout);
  if (name === 'blank') return <>{children}</>;
  // Hand-written configurations may still pass `ui.layouts`; discovery emits layout slots.
  const Named = name ? layoutsOf(runtime)?.[name] : undefined;
  if (Named)
    return (
      <ShellContext.Provider value={{ ...scope, inLayout: true }}>
        <Named>{children}</Named>
      </ShellContext.Provider>
    );
  if (name && name !== 'app') {
    if (!runtime.slots.has(`layout.${name}`))
      throw new Error(
        `AppShell: no layout family "${name}". Add src/layouts/${name}.tsx (or src/layouts/${name}/<variant>.tsx), or a plugin's ui/layouts/${name}.tsx; "app" and "blank" are always available.`,
      );
    const Default = defaultLayouts[name];
    return (
      <ShellContext.Provider value={{ ...scope, inLayout: true }}>
        <PluginSlot
          name={`layout.${name}`}
          fallback={
            Default ? (
              <Default>{children}</Default>
            ) : (
              <AppShellRoot
                {...{ navigationSlot, components, brand, account, header }}
                layout="app"
              >
                {children}
              </AppShellRoot>
            )
          }
        >
          {children}
        </PluginSlot>
      </ShellContext.Provider>
    );
  }
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
      navigationSlot={resolved}
      brand={brand}
      header={header}
      end={navbar ? account : undefined}
    />
  );
  const frame = composed ? (
    children
  ) : (
    <>
      {navbar ? topBar : <SidebarPart navigationSlot={resolved} header={brand} footer={account} />}
      <ContentPart topBar={navbar ? undefined : topBar}>{children}</ContentPart>
    </>
  );
  return (
    <ShellContext.Provider value={scope}>
      <TooltipProvider>
        <SidebarProvider
          data-shell-layout={replaced ? 'app' : layout}
          className={navbar && !replaced ? 'flex-col' : undefined}
        >
          {/* A layout.app contribution replaces the frame and can compose the AppShell parts. */}
          <PluginSlot name="layout.app" fallback={frame}>
            {children}
          </PluginSlot>
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
  Surface: ShellSurface,
  FullPage: ShellFullPage,
  AuthLayout: ShellAuthLayout,
  ErrorLayout: ShellErrorLayout,
  Footer: ShellFooter,
  HeaderRow: ShellHeaderRow,
  Drawer: ShellDrawer,
  NavigationItem,
  NavigationGroup: AppShellNavigationGroup,
});
