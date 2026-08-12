import type { LinkProps } from '@tanstack/react-router';
import {
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SettingsIcon,
  WorkflowIcon,
} from 'lucide-react';

export interface ShellNavItem {
  viewId: string;
  title: string;
  to: NonNullable<LinkProps['to']>;
  icon: LucideIcon;
}

// One list, two consumers: the sidebar renders it and the command palette
// turns it into navigation commands, so a new view is added in one place.
export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  {
    viewId: 'dashboard',
    title: 'Dashboard',
    to: '/',
    icon: LayoutDashboardIcon,
  },
  { viewId: 'graph', title: 'Graph', to: '/graph', icon: WorkflowIcon },
  {
    viewId: 'documents',
    title: 'Documents',
    to: '/documents',
    icon: FileTextIcon,
  },
];

// Pinned to the bottom of the sidebar, away from the content views.
export const SHELL_SETTINGS_ITEM: ShellNavItem = {
  viewId: 'settings',
  title: 'Settings',
  to: '/settings',
  icon: SettingsIcon,
};

export const ALL_SHELL_NAV_ITEMS: ShellNavItem[] = [
  ...SHELL_NAV_ITEMS,
  SHELL_SETTINGS_ITEM,
];
