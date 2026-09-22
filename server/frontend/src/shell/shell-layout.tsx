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
      header={{ height: 56 }}
      navbar={{
        width: 280,
        breakpoint: 'md',
        collapsed: { mobile: !navbarOpened },
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
        <Sidebar onNavigate={navbar.close} />
      </AppShell.Navbar>
      <AppShell.Main className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
