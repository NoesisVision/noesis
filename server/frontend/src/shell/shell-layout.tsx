import { Outlet } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  AgentPanelProvider,
  useAgentPanel,
} from '#/features/agent/agent-panel-context.tsx';
import { AgentPanel } from '#/features/agent/ui/agent-panel.tsx';
import { AppShell } from '#/shared/design-system/app-shell';
import {
  useDisclosure,
  useFullscreenElement,
  useLocalStorage,
} from '#/shared/design-system/hooks';
import {
  ExitFullscreenButton,
  ShellFullscreenContext,
} from '#/shared/ui/shell-fullscreen.tsx';
import { useActiveRoute } from './navigation/use-active-route.ts';
import { Rail } from './rail';
import { TopBar } from './top-bar';
import classes from './shell-layout.module.css';

export function ShellLayout() {
  return (
    <AgentPanelProvider>
      <ShellFrame />
    </AgentPanelProvider>
  );
}

/** The bar, the rail, the page and, when open, the agent beside it. */
function ShellFrame() {
  const [navbarOpened, navbar] = useDisclosure(false);
  const agentPanel = useAgentPanel();
  // Folded to icons, as the reader last left it.
  const [railCollapsed, setRailCollapsed] = useLocalStorage<boolean>({
    key: 'noesis.rail-collapsed',
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  // A phone opens the rail as the whole screen, so it is never folded there.
  const collapsed = railCollapsed && !navbarOpened;
  // The kind of page open, whose colour everything on it is marked with.
  const { activeItem } = useActiveRoute();
  // The content is what goes full screen, so it stays full screen while the
  // views inside it change; the top bar and the rail are simply not painted.
  const { ref, toggle, fullscreen } = useFullscreenElement<HTMLElement>();
  const shellFullscreen = useMemo(
    () => ({
      fullscreen,
      // A browser that refuses leaves the content as it is, which is what the
      // button already shows, so there is nothing to report.
      toggle: () => void toggle().catch(() => {}),
    }),
    [fullscreen, toggle],
  );

  return (
    <AppShell
      header={{ height: 48 }}
      // Always there from `md` up; below it, behind the top bar's burger.
      navbar={{
        width: collapsed ? 64 : 268,
        breakpoint: 'md',
        collapsed: { mobile: !navbarOpened },
      }}
      // The agent down the right, as wide as a conversation reads well at,
      // only while open: shut, it takes no room and nothing is drawn.
      aside={{
        width: 420,
        breakpoint: 'md',
        collapsed: { desktop: !agentPanel.opened, mobile: !agentPanel.opened },
      }}
      padding="lg"
    >
      <AppShell.Header withBorder={false}>
        <ShellFullscreenContext value={shellFullscreen}>
          <TopBar navbarOpened={navbarOpened} onToggleNavbar={navbar.toggle} />
        </ShellFullscreenContext>
      </AppShell.Header>
      <AppShell.Navbar withBorder={false}>
        <Rail
          collapsed={collapsed}
          onToggle={() => setRailCollapsed((folded) => !folded)}
          onNavigate={navbar.close}
        />
      </AppShell.Navbar>
      <AppShell.Aside withBorder={false}>
        {agentPanel.opened && <AgentPanel />}
      </AppShell.Aside>
      <AppShell.Main
        ref={ref}
        className={classes.main}
        data-page-tone={activeItem?.tone}
      >
        <ShellFullscreenContext value={shellFullscreen}>
          <Outlet />
          <ExitFullscreenButton />
        </ShellFullscreenContext>
      </AppShell.Main>
    </AppShell>
  );
}
