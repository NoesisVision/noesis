import { Outlet } from '@tanstack/react-router';
import { useMemo } from 'react';
import { AppShell } from '#/shared/design-system/app-shell';
import {
  useDisclosure,
  useFullscreenElement,
  useLocalStorage,
} from '#/shared/design-system/hooks';
import { ShellFullscreenContext } from '#/shared/ui/shell-fullscreen.tsx';
import { useActiveRoute } from './navigation/use-active-route.ts';
import { Rail } from './rail';
import { TopBar } from './top-bar';
import classes from './shell-layout.module.css';

export function ShellLayout() {
  const [navbarOpened, navbar] = useDisclosure(false);
  // Folded to icons, as the reader last left it.
  const [railCollapsed, setRailCollapsed] = useLocalStorage<boolean>({
    key: 'noesis.rail-collapsed',
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  // A phone opens the rail as the whole screen, so it is never folded there.
  const collapsed = railCollapsed && !navbarOpened;
  // The kind of page open, ruled across its top in its colour.
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
      <AppShell.Main
        ref={ref}
        className={classes.main}
        data-page-tone={activeItem?.tone}
      >
        <ShellFullscreenContext value={shellFullscreen}>
          <Outlet />
        </ShellFullscreenContext>
      </AppShell.Main>
    </AppShell>
  );
}
