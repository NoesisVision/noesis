import { Outlet } from '@tanstack/react-router';
import { useMemo } from 'react';
import { AppShell } from '#/shared/design-system/app-shell';
import {
  useDisclosure,
  useFullscreenElement,
} from '#/shared/design-system/hooks';
import { ShellFullscreenContext } from '#/shared/ui/shell-fullscreen.tsx';
import { ShellHeader } from './shell-header';
import { Sidebar } from './sidebar';
import classes from './shell-layout.module.css';

export function ShellLayout() {
  const [navbarOpened, navbar] = useDisclosure(false);
  // The content is what goes full screen, so it stays full screen while the
  // views inside it change; the header and the sidebar are simply not painted.
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
      header={{ height: { base: 56, md: 105 } }}
      // Only for a narrow screen, where the header's bar is folded away.
      navbar={{
        width: 280,
        breakpoint: 'md',
        collapsed: { desktop: true, mobile: !navbarOpened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <ShellHeader
          navbarOpened={navbarOpened}
          onToggleNavbar={navbar.toggle}
        />
      </AppShell.Header>
      <AppShell.Navbar>
        {navbarOpened && <Sidebar onNavigate={navbar.close} />}
      </AppShell.Navbar>
      <AppShell.Main ref={ref} className={classes.main}>
        <ShellFullscreenContext value={shellFullscreen}>
          <Outlet />
        </ShellFullscreenContext>
      </AppShell.Main>
    </AppShell>
  );
}
