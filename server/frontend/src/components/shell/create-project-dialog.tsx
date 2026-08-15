import { useNavigate } from '@tanstack/react-router';
import { CreateProjectForm } from '@/components/shell/create-project-form';
import { useShell } from '@/components/shell/use-shell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * "New project" from the sidebar selector: the shared CreateProjectForm in a
 * dialog. The first project ever is created inline on the welcome page — this
 * dialog exists for every project after it.
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { installations, switchProject } = useShell();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project groups the repositories of one codebase. It needs at least
            one connected repository.
          </DialogDescription>
        </DialogHeader>
        {installations.length === 0 ? (
          <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-xs">
            No GitHub account is connected yet. Install the App from Settings
            first — you will come back here.
          </p>
        ) : (
          <CreateProjectForm
            installations={installations}
            onCreated={async (project) => {
              switchProject(project.id);
              onOpenChange(false);
              await navigate({ to: '/project' });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
