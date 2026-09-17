import { Outlet } from '@tanstack/react-router';
import { AppShell } from '#/components/design-system/app-shell';
import { useDisclosure } from '#/components/design-system/hooks';
import { ShellHeader } from './shell-header';
import { Sidebar } from './sidebar';

/**
 * The application shell: a 56 px header, a 280 px sidebar that is always open
 * on desktop and a burger-toggled drawer below `md`, and the content area.
 */
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
      <AppShell.Main bg="var(--mantine-color-gray-0)">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
