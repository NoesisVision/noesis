import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  LogOutIcon,
  PuzzleIcon,
  SettingsIcon,
} from 'lucide-react';
import { useShell } from '@/components/shell/use-shell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { INSTALL_HREF, signOut } from '@/lib/auth';

function initialsOf(name: string, login: string): string {
  const source = name.trim() === '' ? login : name;
  const parts = source.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

/**
 * The signed-in account, pinned to the bottom of the sidebar: who you are,
 * where repository access is connected, and the way out.
 */
export function AccountMenu() {
  const { account, installations } = useShell();
  const queryClient = useQueryClient();

  async function logOut() {
    await signOut();
    // The session is gone; drop every cached answer with it so nothing from
    // the previous account survives into the next sign-in. A full navigation
    // (not a router push) also clears in-memory state.
    queryClient.clear();
    window.location.assign('/login');
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-primary-foreground data-popup-open:text-sidebar-accent-foreground"
              >
                <Avatar>
                  <AvatarImage src={account.avatarUrl} alt="" />
                  <AvatarFallback>
                    {initialsOf(account.name, account.login)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{account.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    @{account.login}
                  </span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="min-w-56" align="start" side="top">
            <DropdownMenuGroup>
              {/* Base UI requires the label to sit inside its group. */}
              <DropdownMenuLabel>
                {account.role === 'owner' ? 'Owner' : 'Member'}
              </DropdownMenuLabel>
              <DropdownMenuItem
                render={
                  <Link to="/settings">
                    <SettingsIcon className="size-4" />
                    <span>Settings</span>
                  </Link>
                }
              />
              {/* Connecting repositories is a GitHub screen, not one of ours:
                  an org admin decides there what the App may touch at all. */}
              <DropdownMenuItem
                render={
                  <a href={INSTALL_HREF}>
                    <PuzzleIcon className="size-4" />
                    <span>
                      {installations.length === 0
                        ? 'Connect repositories'
                        : `Repository access (${installations.length})`}
                    </span>
                    <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />
                  </a>
                }
              />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={logOut}>
                <LogOutIcon className="size-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
