import { AppShell as MantineAppShell } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const AppShell = Object.assign(
  wrapComponent(MantineAppShell, 'AppShell'),
  {
    Header: wrapComponent(MantineAppShell.Header, 'AppShell.Header'),
    Navbar: wrapComponent(MantineAppShell.Navbar, 'AppShell.Navbar'),
    Main: wrapComponent(MantineAppShell.Main, 'AppShell.Main'),
    Section: wrapComponent(MantineAppShell.Section, 'AppShell.Section'),
    Aside: wrapComponent(MantineAppShell.Aside, 'AppShell.Aside'),
    Footer: wrapComponent(MantineAppShell.Footer, 'AppShell.Footer'),
  },
);
