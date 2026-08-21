import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { LockIcon, PlusIcon, Trash2Icon, UnplugIcon } from 'lucide-react';
import * as React from 'react';
import { client } from '@/client';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import { GrantAccessLinks, RepoPicker } from '@/components/shell/repo-picker';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
} from '@/components/shell/right-panel';
import { useRightPanel, useShell } from '@/components/shell/use-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PROJECTS_KEY,
  projectDetailQueryOptions,
  projectErrorMessage,
} from '@/lib/projects';

interface ProjectSearch {
  /** Set by `/auth/install/callback` on the grant round-trip. */
  install?: string;
  reason?: string;
}

export const Route = createFileRoute('/_shell/project')({
  validateSearch: (search: Record<string, unknown>): ProjectSearch => ({
    install: typeof search.install === 'string' ? search.install : undefined,
    reason: typeof search.reason === 'string' ? search.reason : undefined,
  }),
  component: ProjectView,
  staticData: { breadcrumb: 'Project', viewId: 'project' },
});

export function ProjectPanel() {
  const { project } = useShell();
  if (project === null) return null;
  return (
    <>
      <PanelHeading>Project</PanelHeading>
      <PanelBody>
        <PanelFields
          fields={{
            Name: project.name,
            Repositories: String(project.repositoryCount),
            Disconnected: String(project.disconnectedCount),
          }}
        />
      </PanelBody>
    </>
  );
}

function StatusBadge({ status, since }: { status: string; since: string }) {
  if (status === 'connected') {
    return <Badge variant="outline">connected</Badge>;
  }
  return (
    <Badge variant="destructive">
      disconnected since {new Date(since).toLocaleDateString()}
    </Badge>
  );
}

function RepositoriesSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { installations } = useShell();
  const detail = useQuery(projectDetailQueryOptions(projectId));
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(new Set());

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
  };

  const attach = useMutation({
    mutationFn: async (repositoryId: string) => {
      // Assigned to a variable so the excess-property check does not reject
      // `json` — the route has no validator, so the client types only `param`.
      const args = { param: { id: projectId }, json: { repositoryId } };
      const response = await client.ui.projects[':id'].repositories.$post(args);
      if (!response.ok) {
        throw new Error(
          projectErrorMessage(
            (await response.json()) as Parameters<
              typeof projectErrorMessage
            >[0],
          ),
        );
      }
    },
    onSuccess: async () => {
      setAttachOpen(false);
      setPicked(new Set());
      await invalidate();
    },
  });

  const detach = useMutation({
    mutationFn: async (repoId: string) => {
      const response = await client.ui.projects[':id'].repositories[
        ':repoId'
      ].$delete({ param: { id: projectId, repoId } });
      if (!response.ok) {
        throw new Error(
          projectErrorMessage((await response.json()) as { error?: string }),
        );
      }
    },
    onSuccess: invalidate,
  });

  if (detail.isPending) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (detail.error) {
    return <p className="text-sm text-destructive">{detail.error.message}</p>;
  }

  const { repositories, healthChecked, installationId } = detail.data;
  const installation = installations.find((i) => i.id === installationId);
  const stale = repositories.filter((r) => r.status === 'disconnected');

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Repositories</h2>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setAttachOpen(true)}
        >
          <PlusIcon />
          <span>Connect repository</span>
        </Button>
      </div>

      {!healthChecked && (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-xs">
          GitHub could not be reached — connection state may be out of date.
        </p>
      )}
      {stale.length > 0 && (
        <p className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-card-foreground shadow-xs">
          The App lost access to {stale.length} repositor
          {stale.length === 1 ? 'y' : 'ies'}. Existing results for them are no
          longer current; re-grant access on GitHub to resume.
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {repositories.map((repo) => (
          <li
            key={repo.id}
            className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-xs"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-sm font-medium">
                {repo.fullName}
              </span>
              {repo.private && (
                <LockIcon className="size-3 shrink-0 text-muted-foreground" />
              )}
            </span>
            <StatusBadge status={repo.status} since={repo.statusChangedAt} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Detach ${repo.fullName}`}
              disabled={detach.isPending}
              onClick={() => detach.mutate(repo.id)}
            >
              <UnplugIcon />
            </Button>
          </li>
        ))}
      </ul>

      {detach.error && (
        <p className="text-sm text-destructive">{detach.error.message}</p>
      )}

      <GrantAccessLinks installation={installation} returnTo="/project" />

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect a repository</DialogTitle>
            <DialogDescription>
              From the repositories the App can reach through{' '}
              {installation?.accountLogin ?? 'this installation'}.
            </DialogDescription>
          </DialogHeader>
          {installationId !== null && (
            <RepoPicker
              installationId={installationId}
              selected={picked}
              onToggle={(id) => setPicked(new Set([id]))}
              excludeIds={repositories.map((r) => r.id)}
            />
          )}
          <GrantAccessLinks installation={installation} returnTo="/project" />
          {attach.error && (
            <p className="text-sm text-destructive">{attach.error.message}</p>
          )}
          <DialogFooter>
            <Button
              disabled={picked.size === 0 || attach.isPending}
              onClick={() => {
                const [id] = picked;
                if (id !== undefined) attach.mutate(id);
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Hard delete behind the type-the-name confirmation (resolved deletion question). */
function DangerSection({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = React.useState('');

  const remove = useMutation({
    mutationFn: async () => {
      const response = await client.ui.projects[':id'].$delete({
        param: { id: projectId },
      });
      if (!response.ok) {
        throw new Error(
          projectErrorMessage((await response.json()) as { error?: string }),
        );
      }
    },
    onSuccess: async () => {
      setConfirmation('');
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-destructive">Delete project</h2>
        <p className="text-sm text-muted-foreground">
          Removes the project and the analysis data of its repositories. Type
          the project name to confirm; recovering means re-connecting and
          re-scanning.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (confirmation === projectName) remove.mutate();
        }}
      >
        <Input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={projectName}
          aria-label={`Type ${projectName} to confirm deletion`}
        />
        <Button
          type="submit"
          variant="destructive"
          disabled={confirmation !== projectName || remove.isPending}
        >
          <Trash2Icon />
          <span>Delete</span>
        </Button>
      </form>
      {remove.error && (
        <p className="text-sm text-destructive">{remove.error.message}</p>
      )}
    </section>
  );
}

const INSTALL_MESSAGES: Record<string, string> = {
  connected: 'Repository access connected — the list below is up to date.',
  requested:
    'The install was requested. An organisation admin has to approve it before those repositories appear here.',
};

function ProjectView() {
  const { project } = useShell();
  const { install } = Route.useSearch();
  useRightPanel(ProjectPanel);

  // Unreachable in practice: with zero projects the layout renders the
  // welcome page instead of the shell, and with any project the provider
  // falls back to the first one.
  if (project === null) return null;

  const message =
    install === undefined
      ? undefined
      : (INSTALL_MESSAGES[install] ??
        'Connecting the installation failed. Try again from Settings.');

  return (
    <PlaceholderView
      title={project.name}
      description="The repositories that make up this codebase, and their App access."
    >
      {message !== undefined && (
        <p className="max-w-2xl rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs">
          {message}
        </p>
      )}
      <RepositoriesSection projectId={project.id} />
      <DangerSection projectId={project.id} projectName={project.name} />
    </PlaceholderView>
  );
}
