import { Outlet, useMatches } from '@tanstack/react-router';
import * as React from 'react';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { CommandPalette } from '@/components/shell/command-palette';
import { RightPanel } from '@/components/shell/right-panel';
import { ShellProvider } from '@/components/shell/shell-provider';
import {
  readShellState,
  writeShellState,
} from '@/components/shell/shell-store';
import { TopBar } from '@/components/shell/top-bar';
import {
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  useShell,
} from '@/components/shell/use-shell';
import { useShellHotkeys } from '@/components/shell/use-shell-hotkeys';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

function ContentArea() {
  const { rightPanel, setRightPanelWidth } = useShell();
  const isMobile = useIsMobile();
  // No bottom-sheet fallback yet: on a phone the panel simply steps aside.
  const showRightPanel = !isMobile && rightPanel.open;
  const widthRef = React.useRef(rightPanel.width);

  return (
    <ResizablePanelGroup
      className="min-h-0 flex-1"
      onLayoutChanged={(_layout, meta) => {
        // Only a drag or a keyboard resize is worth persisting; mount and
        // constraint recomputes would just echo the stored value back.
        if (meta.isUserInteraction) setRightPanelWidth(widthRef.current);
      }}
    >
      <ResizablePanel id="main" minSize="30%" className="overflow-auto">
        <Outlet />
      </ResizablePanel>
      {showRightPanel && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="right"
            defaultSize={rightPanel.width}
            minSize={RIGHT_PANEL_MIN_WIDTH}
            maxSize={RIGHT_PANEL_MAX_WIDTH}
            groupResizeBehavior="preserve-pixel-size"
            onResize={(size) => {
              widthRef.current = size.inPixels;
            }}
          >
            <RightPanel />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

function ShellFrame() {
  useShellHotkeys();

  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <TopBar />
        <ContentArea />
      </SidebarInset>
      <CommandPalette />
    </>
  );
}

/**
 * The application shell: sidebar, top bar, routed main section and the
 * contextual right panel. Rendered by the pathless `_shell` layout route, so
 * every view inside it is framed identically.
 */
export function ShellLayout() {
  const matches = useMatches();
  // The deepest route that claims a view id owns the per-view shell state.
  const viewId =
    matches.findLast((match) => match.staticData.viewId)?.staticData.viewId ??
    'shell';

  const [sidebarOpen, setSidebarOpen] = React.useState(
    () => readShellState<string>('sidebar', 'expanded') !== 'collapsed',
  );

  return (
    <ShellProvider viewId={viewId}>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(open) => {
          setSidebarOpen(open);
          writeShellState('sidebar', open ? 'expanded' : 'collapsed');
        }}
      >
        <ShellFrame />
      </SidebarProvider>
    </ShellProvider>
  );
}
