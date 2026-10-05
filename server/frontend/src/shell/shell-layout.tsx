import { Outlet } from '@tanstack/react-router';
import { AppShell } from '#/shared/design-system/app-shell';
import { useDisclosure } from '#/shared/design-system/hooks';
import { ShellHeader } from './shell-header';
import { Sidebar } from './sidebar';
import classes from './shell-layout.module.css';

export function ShellLayout() {
  const [navbarOpened, navbar] = useDisclosure(false);

  return (
    <AppShell
      header={{ height: { base: 56, md: 101 } }}
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
      <AppShell.Main className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
