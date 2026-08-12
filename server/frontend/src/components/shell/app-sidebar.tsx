import { Link } from '@tanstack/react-router';
import {
  SHELL_NAV_ITEMS,
  SHELL_SETTINGS_ITEM,
  type ShellNavItem,
} from '@/components/shell/nav-items';
import { ProjectSelector } from '@/components/shell/project-selector';
import { useShell } from '@/components/shell/use-shell';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

function NavMenuItem({ item }: { item: ShellNavItem }) {
  const { viewId } = useShell();
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={item.viewId === viewId}
        tooltip={item.title}
        // Terracotta rail on the active view — the shell's one accent, and the
        // only cue that survives icon-collapsed mode.
        className="relative data-active:before:absolute data-active:before:inset-y-1 data-active:before:left-0 data-active:before:w-[3px] data-active:before:rounded-r-full data-active:before:bg-primary"
        render={
          <Link
            to={item.to}
            onClick={() => {
              // The off-canvas sheet would otherwise stay over the view the
              // user just navigated to.
              if (isMobile) setOpenMobile(false);
            }}
          >
            <Icon />
            <span>{item.title}</span>
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <ProjectSelector />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SHELL_NAV_ITEMS.map((item) => (
                <NavMenuItem key={item.viewId} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Settings sits apart from the content views, pinned to the bottom. */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <NavMenuItem item={SHELL_SETTINGS_ITEM} />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
