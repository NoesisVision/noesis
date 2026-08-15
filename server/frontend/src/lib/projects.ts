import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client';

// All shapes are inferred from the server's handlers through `AppType`
// (decision 28): a field renamed on the server stops this app from compiling.
export type ProjectSummary = InferResponseType<
  typeof client.ui.projects.$get,
  200
>['projects'][number];

export type ProjectDetail = InferResponseType<
  (typeof client.ui.projects)[':id']['$get'],
  200
>;

export type PickerRepository = InferResponseType<
  (typeof client.ui.github.installations)[':id']['repositories']['$get'],
  200
>['repositories'][number];

export const PROJECTS_KEY = ['ui', 'projects'] as const;

export const projectsQueryOptions = queryOptions({
  queryKey: PROJECTS_KEY,
  queryFn: async () => {
    const response = await client.ui.projects.$get();
    if (!response.ok) {
      throw new Error(`Could not load projects (${response.status}).`);
    }
    return (await response.json()).projects;
  },
});

/** The detail fetch runs the server's on-demand access check — keep it fresh-by-request, never cached long. */
export function projectDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: async (): Promise<ProjectDetail> => {
      const response = await client.ui.projects[':id'].$get({
        param: { id },
      });
      if (!response.ok) {
        throw new Error(`Could not load the project (${response.status}).`);
      }
      return response.json();
    },
    staleTime: 0,
  });
}

/**
 * The repo-picker source for one installation. `enabled` gating is the
 * caller's job — the query only makes sense once an installation is chosen.
 */
export function pickerQueryOptions(installationId: string) {
  return queryOptions({
    queryKey: ['ui', 'github', 'installations', installationId] as const,
    queryFn: async () => {
      const response = await client.ui.github.installations[
        ':id'
      ].repositories.$get({ param: { id: installationId } });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(pickerErrorMessage(body.error, response.status));
      }
      return (await response.json()).repositories;
    },
    // The list changes on GitHub, outside our sight; always refetch on mount
    // so the return from a grant round-trip shows the new repository.
    staleTime: 0,
  });
}

function pickerErrorMessage(error: string | undefined, status: number): string {
  switch (error) {
    case 'github_unreachable':
      return 'GitHub is not reachable right now. Try again in a moment.';
    case 'unknown_installation':
      return 'That installation is not linked to your account.';
    case 'auth_disabled':
      return 'Project creation needs GitHub sign-in (auth is disabled on this instance).';
    default:
      return `Could not load repositories (${status}).`;
  }
}

/** Maps the write refusals (projects.md §2) to the sentences the UI shows. */
export function projectErrorMessage(body: {
  error?: string;
  existing?: { name: string };
  owningProject?: { name: string };
  repositoryId?: string;
}): string {
  switch (body.error) {
    case 'duplicate_name':
      return `A project named "${body.existing?.name}" already exists.`;
    case 'repository_already_connected':
      return `That repository already belongs to "${body.owningProject?.name}". Detach it there first.`;
    case 'last_repository':
      return 'A project needs at least one repository. Delete the project instead.';
    case 'repository_not_reachable':
      return 'The App cannot reach that repository (any more). Grant access on GitHub first.';
    case 'version_conflict':
      return 'Someone changed this project in the meantime. Reload and retry.';
    case 'auth_disabled':
      return 'Project changes need GitHub sign-in (auth is disabled on this instance).';
    default:
      return body.error ?? 'The request failed.';
  }
}
