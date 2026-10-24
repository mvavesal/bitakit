'use client';
import { createElement, type ReactNode, type ReactElement, type ComponentType } from 'react';
import { Direction } from 'radix-ui';
import {
  PluginSlot,
  SlotErrorBoundary,
  useSlot,
  type SlotView,
  type SlotErrorFallback,
} from '@bitakit/ui';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@bitakit/ui/components';

/** Every custom Shell renderer retains the standard per-contribution error boundary. */
export function renderRegion(name: string, view: SlotView, errorFallback?: SlotErrorFallback) {
  if (view.error) throw view.error;
  return view.items.flatMap((entry) =>
    entry.kind === 'component'
      ? [
          <SlotErrorBoundary
            key={entry.key}
            slot={name}
            plugin={entry.plugin}
            contribution={entry.key}
            errorFallback={errorFallback}
          >
            {createElement(entry.component, { payload: view.payload })}
          </SlotErrorBoundary>,
        ]
      : [],
  );
}
export type ShellSurfaceProps = { children?: ReactNode };
/** Shared content spacing for framed and full-page layouts; the host theme supplies visuals. */
export function ShellSurface({ children }: ShellSurfaceProps) {
  return (
    <div
      data-shell-surface=""
      className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6"
    >
      <PluginSlot name="shell.content.before" />
      {children}
      <PluginSlot name="shell.content.after" />
    </div>
  );
}
export function ShellFullPage({
  children,
  surface: Surface = ShellSurface,
}: ShellSurfaceProps & { surface?: ComponentType<ShellSurfaceProps> }) {
  return (
    <div data-shell-layout="full-page" className="flex min-h-svh min-w-0 flex-col">
      <Surface>{children}</Surface>
    </div>
  );
}
/** Shell's default `layout.auth`: a narrow centered column with the brand above the page. */
export function ShellAuthLayout({ children }: ShellSurfaceProps) {
  return (
    <div
      data-shell-layout="auth"
      className="flex min-h-svh min-w-0 flex-col items-center justify-center bg-muted p-6 md:p-10"
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <PluginSlot name="shell.brand" />
        {children}
      </div>
    </div>
  );
}
/** Shell's default `layout.error`: the page centered, without navigation. */
export function ShellErrorLayout({ children }: ShellSurfaceProps) {
  return (
    <div
      data-shell-layout="error"
      className="flex min-h-svh min-w-0 flex-col items-center justify-center p-6 md:p-10"
    >
      <div className="flex w-full max-w-lg flex-col gap-6">{children}</div>
    </div>
  );
}
export function ShellFooter({ children }: ShellSurfaceProps) {
  return (
    <footer className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-2 empty:hidden">
      <PluginSlot name="shell.footer" />
      {children}
    </footer>
  );
}
/** A row is an ordinary contribution. Context targets its regions without numbered global slots. */
export function ShellHeaderRow({
  id,
  start,
  end,
}: {
  id: string;
  start?: ReactNode;
  end?: ReactNode;
}) {
  const payload = { rowId: id };
  const leading = useSlot('shell.header.row.start', { payload });
  const trailing = useSlot('shell.header.row.end', { payload });
  const left = renderRegion('shell.header.row.start', leading);
  const right = renderRegion('shell.header.row.end', trailing);
  if (!left.length && !right.length && start == null && end == null) return null;
  return (
    <div
      data-shell-row={id}
      className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {start}
        {left}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {right}
        {end}
      </div>
    </div>
  );
}
export type ShellDrawerProps = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  trigger: ReactElement;
  children?: ReactNode;
  footer?: ReactNode;
  side?: 'start' | 'end';
  dir?: 'ltr' | 'rtl';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
/** Radix Sheet owns focus, dismissal and modality. An ID scopes contribution predicates. */
export function ShellDrawer({
  id,
  title,
  description,
  trigger,
  children,
  footer,
  side = 'end',
  dir,
  open,
  onOpenChange,
}: ShellDrawerProps) {
  const direction = Direction.useDirection(dir);
  const payload = { drawerId: id };
  const physical = (side === 'start') === (direction === 'ltr') ? 'left' : 'right';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side={physical}
        dir={direction}
        {...(description == null ? { 'aria-describedby': undefined } : {})}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description != null && <SheetDescription>{description}</SheetDescription>}
          <PluginSlot name="shell.drawer.header" payload={payload} />
        </SheetHeader>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          {children}
          <PluginSlot name="shell.drawer.body" payload={payload} />
        </div>
        <SheetFooter>
          <PluginSlot name="shell.drawer.footer" payload={payload} />
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
