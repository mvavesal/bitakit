'use client';

import { useId, useState, type CSSProperties } from 'react';
import {
  Button,
  SheetClose,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarProvider,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from '@bitakit/ui/components';
import { usePanelRef, type PanelImperativeHandle, type PanelSize } from 'react-resizable-panels';
import SidebarCloseIcon from 'reicon-react/icons/SidebarLeft2';
import SidebarOpenIcon from 'reicon-react/icons/SidebarRight2';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { CodeFileTree } from './code-file-tree';
import type { PluginCode } from './code-files';

/** The files of one playground plugin, exactly as they run in the app. */
export function CodeView({ code, plugin }: { code: PluginCode[]; plugin: string }) {
  const current = code.find((entry) => entry.id === plugin) ?? code[0];
  return <CodeSidebar key={current.id} current={current} />;
}

/** Sidebar owns mobile behavior; Resizable owns desktop width and its restoration. */
function CodeSidebar({ current }: { current: PluginCode }) {
  const panelRef = usePanelRef();
  const [open, setOpen] = useState(true);
  return (
    <SidebarProvider
      shortcut={false}
      open={open}
      onOpenChange={(next) => {
        if (next) panelRef.current?.expand();
        else panelRef.current?.collapse();
      }}
      className="h-full min-h-0 min-w-0 flex-col"
    >
      <CodeFiles
        current={current}
        panelRef={panelRef}
        onPanelResize={(size) => setOpen(size.inPixels > 0)}
      />
    </SidebarProvider>
  );
}

function CodeFiles({
  current,
  panelRef,
  onPanelResize,
}: {
  current: PluginCode;
  panelRef: React.RefObject<PanelImperativeHandle | null>;
  onPanelResize: (size: PanelSize) => void;
}) {
  const { open, openMobile, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const treeId = useId();
  const file = current.files.find((entry) => entry.path === selected) ?? current.files[0];
  const lines = current.files.reduce((sum, entry) => sum + entry.lines, 0);
  const counts = `${current.files.length} files, ${lines} lines`;
  const visible = isMobile ? openMobile : open;
  const label = visible ? 'Hide files' : 'Show files';
  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-expanded={visible}
      aria-controls={isMobile ? undefined : treeId}
      onClick={isMobile ? undefined : toggleSidebar}
    >
      {visible ? <SidebarCloseIcon aria-hidden="true" /> : <SidebarOpenIcon aria-hidden="true" />}
    </Button>
  );
  const source = (
    <div
      className="code-view h-full min-h-0 overflow-auto p-5 text-[13px] leading-relaxed"
      // Highlighted by Shiki on the server from this repository's own files.
      dangerouslySetInnerHTML={{ __html: file.html }}
    />
  );

  return (
    <>
      <div className="flex min-w-0 items-center gap-3 border-b p-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild data-slot="button">
              {isMobile ? (
                <SheetTrigger asChild data-slot="button">
                  {trigger}
                </SheetTrigger>
              ) : (
                trigger
              )}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <code className="min-w-0 truncate text-xs text-muted-foreground" title={file.path}>
          {file.path}
        </code>
      </div>
      <div className="hidden min-h-0 flex-1 md:block">
        <ResizablePanelGroup
          orientation="horizontal"
          className="[&>[data-panel]]:transition-[flex-grow] [&>[data-panel]]:duration-[var(--theme-motion-duration,200ms)] [&>[data-panel]]:ease-[var(--theme-motion-ease,linear)] [&:has([data-separator=active])>[data-panel]]:transition-none"
        >
          <ResizablePanel
            panelRef={panelRef}
            defaultSize="15rem"
            minSize="10rem"
            maxSize="50%"
            collapsible
            onResize={onPanelResize}
          >
            <div
              className="@container relative h-full w-full overflow-hidden"
              style={{ '--sidebar-width': '100cqw' } as CSSProperties}
            >
              <Sidebar
                id={treeId}
                mobileTitle="Files"
                mobileDescription="Browse the plugin source files."
                className="absolute h-full"
                inert={!isMobile && !open}
              >
                <SidebarHeader>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Files</span>
                    {isMobile && (
                      <SheetClose asChild data-slot="button">
                        <Button variant="ghost" size="icon-sm" aria-label="Hide files">
                          <SidebarCloseIcon aria-hidden="true" />
                        </Button>
                      </SheetClose>
                    )}
                  </div>
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <CodeFileTree
                      files={current.files}
                      selected={file.path}
                      expandedItems={expandedItems}
                      onExpandedItemsChange={setExpandedItems}
                      onSelect={(path) => {
                        setSelected(path);
                        if (isMobile) setOpenMobile(false);
                      }}
                    />
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter className="border-t text-xs text-muted-foreground md:hidden">
                  {counts}
                </SidebarFooter>
              </Sidebar>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="Resize files panel" />
          <ResizablePanel minSize="50%">{source}</ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="min-h-0 flex-1 md:hidden">{source}</div>
      <div className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">{counts}</div>
    </>
  );
}
