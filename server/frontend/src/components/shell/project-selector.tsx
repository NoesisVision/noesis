import { Link } from '@tanstack/react-router';
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react';
import * as React from 'react';
import { CreateProjectDialog } from '@/components/shell/create-project-dialog';
import { useShell } from '@/components/shell/use-shell';
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

function ProjectMark({ name }: { name: string }) {
  return (
    <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-medium text-sidebar-primary-foreground">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A red dot when some of the project's repositories lost App access. */
function HealthDot({ disconnected }: { disconnected: number }) {
  if (disconnected === 0) return null;
  return (
    <span
      className="size-2 shrink-0 rounded-full bg-destructive"
      title={`${disconnected} repositor${disconnected === 1 ? 'y' : 'ies'} disconnected`}
    />
  );
}

// The sidebar header doubles as the project switcher (IntelliJ-style): the
// current project is always visible, and switching is one click away. The
// projects themselves are server data (`/ui/projects`) — the shell only
// consumes the list.
export function ProjectSelector() {
  const { project, projects, switchProject } = useShell();
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              >
                <ProjectMark name={project?.name ?? '?'} />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">
                    {project?.name ?? 'No project'}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Project
                  </span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="min-w-56" align="start" side="bottom">
            {projects.length > 0 && (
              <>
                <DropdownMenuGroup>
                  {/* Base UI requires the label to sit inside its group. */}
                  <DropdownMenuLabel>Projects</DropdownMenuLabel>
                  {projects.map((candidate) => (
                    <DropdownMenuItem
                      key={candidate.id}
                      onClick={() => switchProject(candidate.id)}
                    >
                      <ProjectMark name={candidate.name} />
                      <span className="truncate">{candidate.name}</span>
                      <HealthDot disconnected={candidate.disconnectedCount} />
                      {candidate.id === project?.id && (
                        <CheckIcon className="ml-auto size-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              {project !== null && (
                <DropdownMenuItem
                  render={
                    <Link to="/project">
                      <SettingsIcon className="size-4" />
                      <span>Project settings</span>
                    </Link>
                  }
                />
              )}
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                <span>New project</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SidebarMenu>
  );
}
