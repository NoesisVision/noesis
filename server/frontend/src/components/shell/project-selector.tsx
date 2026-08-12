import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import * as React from 'react';
import { useShell } from '@/components/shell/use-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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

// The sidebar header doubles as the project switcher (IntelliJ-style): the
// current project is always visible, and switching is one click away. Project
// storage lives elsewhere — the shell only consumes whatever list it is given.
export function ProjectSelector() {
  const { project, projects, switchProject, addProject } = useShell();
  const [addOpen, setAddOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  function submitNewProject(event: React.FormEvent) {
    event.preventDefault();
    if (newName.trim() === '') return;
    addProject(newName);
    setNewName('');
    setAddOpen(false);
  }

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
                <ProjectMark name={project} />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{project}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Project
                  </span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="min-w-56" align="start" side="bottom">
            <DropdownMenuGroup>
              {/* Base UI requires the label to sit inside its group. */}
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              {projects.map((name) => (
                <DropdownMenuItem
                  key={name}
                  onClick={() => switchProject(name)}
                >
                  <ProjectMark name={name} />
                  <span className="truncate">{name}</span>
                  {name === project && <CheckIcon className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setAddOpen(true)}>
                <PlusIcon className="size-4" />
                <span>New project</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={submitNewProject} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Projects scope everything the shell shows. Backing storage is
                not wired up yet — this one lives in your browser.
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Project name"
              aria-label="Project name"
            />
            <DialogFooter>
              <Button type="submit" disabled={newName.trim() === ''}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
