import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLinkIcon,
  PlusIcon,
} from 'lucide-react';
import * as React from 'react';
import { client } from '@/client';
import { RepoPicker } from '@/components/shell/repo-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Installation } from '@/lib/auth';
import { PROJECTS_KEY, projectErrorMessage } from '@/lib/projects';
import { cn } from '@/lib/utils';

export interface CreatedProject {
  id: string;
  name: string;
}

/**
 * The create-project form (projects.md §5): name, installation, and at least
 * one repository — shared between the welcome page (inline) and the "New
 * project" dialog. Free of shell context on purpose: the welcome page renders
 * before any shell exists.
 */
export function CreateProjectForm({
  installations,
  onCreated,
  title,
}: {
  installations: Installation[];
  onCreated: (project: CreatedProject) => void | Promise<void>;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [nameSubmitted, setNameSubmitted] = React.useState(false);

  const [installationId, setInstallationId] = React.useState<string | null>(
    installations[0]?.id ?? null,
  );
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const installation = installations.find((i) => i.id === installationId);

  const create = useMutation({
    mutationFn: async () => {
      if (installationId === null) throw new Error('Pick an installation.');
      const response = await client.ui.projects.$post({
        json: {
          name: name.trim(),
          installationId,
          repositoryIds: [...selected],
        },
      });
      if (!response.ok) {
        // The refusal branches return untyped Responses on the server, so the
        // client narrows them by hand.
        throw new Error(
          projectErrorMessage(
            (await response.json()) as Parameters<
              typeof projectErrorMessage
            >[0],
          ),
        );
      }
      return ((await response.json()) as { project: CreatedProject }).project;
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      setName('');
      setSelected(new Set());
      await onCreated(project);
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const submittable =
    name.trim() !== '' &&
    installationId !== null &&
    selected.size > 0 &&
    !create.isPending;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (submittable) create.mutate();
      }}
    >
      {!nameSubmitted ? (
        <>
          {!!title && <h2 className="text-sm font-semibold">{title}</h2>}
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim() !== '') {
                setNameSubmitted(true);
              }
            }}
            placeholder="Project name"
            aria-label="Project name"
          />
          <Button
            disabled={name.trim() === ''}
            onClick={() => setNameSubmitted(true)}
          >
            <span>Next</span>
            <ChevronRight />
          </Button>
        </>
      ) : (
        <>
          <div>
            <Button
              disabled={create.isPending}
              onClick={() => setNameSubmitted(false)}
              variant="ghost"
              className="flex"
            >
              <ChevronLeft />
              <span>Back</span>
            </Button>
          </div>
          {installations.length > 1 && (
            <>
              <h2 className="text-sm font-semibold">Select an installation</h2>
              <div className="flex flex-wrap gap-1">
                {installations.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setInstallationId(candidate.id);
                      // A project binds to one installation (decision 46); picks do
                      // not carry across.
                      setSelected(new Set());
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-1 text-sm cursor-pointer hover:bg-accent',
                      candidate.id === installationId
                        ? 'border-primary bg-accent'
                        : 'bg-card',
                    )}
                  >
                    {candidate.accountLogin}
                  </button>
                ))}
              </div>
            </>
          )}

          {installationId !== null && (
            <>
              <h2 className="text-sm font-semibold">Select repository</h2>
              <RepoPicker
                installationId={installationId}
                selected={selected}
                onToggle={toggle}
              />
              <p className="text-xs text-muted-foreground">
                Repositories the App can reach on{' '}
                <strong>
                  {installation?.accountLogin ?? 'this installation'}
                </strong>{' '}
                — pick at least one.
              </p>
            </>
          )}

          {create.error && (
            <p className="text-sm text-destructive">{create.error.message}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {installation !== undefined && (
              <a
                href={installation.manageUrl}
                target="_blank"
                rel="noreferrer"
                title="Manage repository access on GitHub"
                className={buttonVariants({
                  variant: 'outline',
                  className: 'ml-auto',
                })}
              >
                <ExternalLinkIcon />
                <span>Manage repositories</span>
              </a>
            )}
          </div>

          <Button type="submit" disabled={!submittable}>
            <PlusIcon />
            <span>{create.isPending ? 'Creating…' : 'Create project'}</span>
          </Button>
        </>
      )}
    </form>
  );
}
