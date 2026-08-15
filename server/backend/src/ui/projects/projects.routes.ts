import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../../auth/auth.middleware.js';
import type { AuthModule } from '../../auth/auth.module.js';
import {
  GhCredentialExpiredError,
  type GhRepositorySummary,
} from '../../auth/github.service.js';
import { ConcurrencyConflictError } from '../../database/concurrency.js';
import {
  DuplicateProjectNameError,
  type RepositoryRow,
} from '../../projects/projects.repository.js';
import {
  LastRepositoryError,
  ProjectNotFoundError,
  type ProjectsService,
  RepositoryOwnedError,
} from '../../projects/projects.service.js';
import type { RepoAccessService } from '../../projects/repo-access.service.js';
import { reachableRepositories } from './github-repos.js';

export interface ProjectsDeps {
  authModule: AuthModule;
  projectsService: ProjectsService;
  /** Null in disabled auth mode — no App, nothing to check against. */
  repoAccess: RepoAccessService | null;
}

const nameSchema = z.string().trim().min(1).max(100);

export const createProjectSchema = z.object({
  name: nameSchema,
  installationId: z.string().min(1),
  repositoryIds: z.array(z.string().min(1)).min(1),
});

export const renameProjectSchema = z.object({
  name: nameSchema,
  version: z.number().int().min(0),
});

export const attachRepositorySchema = z.object({
  repositoryId: z.string().min(1),
});

/** What a repository row looks like to the client. */
function toRepositoryDto(row: RepositoryRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    private: row.private,
    status: row.status,
    statusChangedAt: row.status_changed_at,
  };
}

/**
 * Mounted at `/ui/projects` behind `requireSession`. Reads work in every
 * auth mode; the GitHub-dependent writes answer 503 in disabled mode — same
 * stance as the invites routes, and the resolved disabled-mode question:
 * the ≥1-repository invariant is identical everywhere, so testing the full
 * flow locally means a locally registered App.
 */
export function createProjectsApp(deps: ProjectsDeps) {
  const { authModule, projectsService, repoAccess } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono<AuthEnv>()
      .get('/', async (c) => {
        return c.json({ projects: await projectsService.list() });
      })

      .post('/', async (c) => {
        if (authModule.mode === 'disabled') {
          return c.json({ error: 'auth_disabled' }, 503);
        }
        const parsed = createProjectSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        const { name, installationId, repositoryIds } = parsed.data;

        const reachable = await listReachable(c, authModule, installationId);
        if (!reachable.ok) return reachable.response;
        const inputs = resolveInputs(repositoryIds, reachable.repositories);
        if (!inputs.ok) {
          return c.json(
            { error: 'repository_not_reachable', repositoryId: inputs.missing },
            400,
          );
        }

        try {
          const project = await projectsService.createWithRepositories(
            name,
            installationId,
            inputs.inputs,
          );
          return c.json({ project }, 201);
        } catch (error) {
          const refused = refusalResponse(c, error);
          if (refused !== null) return refused;
          throw error;
        }
      })

      // The on-demand access check runs here (projects.md §3), so what the
      // client renders is fresh; when GitHub is unreachable the stored state
      // is served flagged `healthChecked: false` rather than failing the page.
      .get('/:id', async (c) => {
        const id = c.req.param('id');
        const project = await projectsService.findById(id);
        if (project === null) return c.json({ error: 'not_found' }, 404);

        const checked = repoAccess
          ? await repoAccess.checkProject(id)
          : {
              healthChecked: false,
              repositories: await projectsService.listRepositories(id),
            };
        return c.json({
          project,
          installationId: await projectsService.findInstallationId(id),
          healthChecked: checked.healthChecked,
          repositories: checked.repositories.map(toRepositoryDto),
        });
      })

      .patch('/:id', async (c) => {
        if (authModule.mode === 'disabled') {
          return c.json({ error: 'auth_disabled' }, 503);
        }
        const parsed = renameProjectSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        try {
          const project = await projectsService.rename(
            c.req.param('id'),
            parsed.data.name,
            parsed.data.version,
          );
          return c.json({ project });
        } catch (error) {
          if (error instanceof DuplicateProjectNameError) {
            return c.json(
              {
                error: 'duplicate_name',
                existing: { id: error.existing.id, name: error.existing.name },
              },
              409,
            );
          }
          if (error instanceof ConcurrencyConflictError) {
            return c.json({ error: 'version_conflict' }, 409);
          }
          if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'not_found' }, 404);
          }
          throw error;
        }
      })

      // Hard delete (resolved deletion question). The type-the-name
      // confirmation is a UI affordance; the API deletes on DELETE.
      .delete('/:id', async (c) => {
        if (authModule.mode === 'disabled') {
          return c.json({ error: 'auth_disabled' }, 503);
        }
        const deleted = await projectsService.delete(c.req.param('id'));
        if (!deleted) return c.json({ error: 'not_found' }, 404);
        return c.body(null, 204);
      })

      .post('/:id/repositories', async (c) => {
        if (authModule.mode === 'disabled') {
          return c.json({ error: 'auth_disabled' }, 503);
        }
        const parsed = attachRepositorySchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        const projectId = c.req.param('id');
        const installationId =
          await projectsService.findInstallationId(projectId);
        if (installationId === null) {
          return c.json({ error: 'not_found' }, 404);
        }

        const reachable = await listReachable(c, authModule, installationId);
        if (!reachable.ok) return reachable.response;
        const inputs = resolveInputs(
          [parsed.data.repositoryId],
          reachable.repositories,
        );
        if (!inputs.ok) {
          return c.json(
            { error: 'repository_not_reachable', repositoryId: inputs.missing },
            400,
          );
        }

        try {
          const input = inputs.inputs[0];
          if (input === undefined) throw new Error('unreachable');
          const attached = await projectsService.attachRepository(
            projectId,
            input,
          );
          return c.json({ repository: toRepositoryDto(attached) }, 201);
        } catch (error) {
          const refused = refusalResponse(c, error);
          if (refused !== null) return refused;
          if (error instanceof ProjectNotFoundError) {
            return c.json({ error: 'not_found' }, 404);
          }
          throw error;
        }
      })

      .delete('/:id/repositories/:repoId', async (c) => {
        if (authModule.mode === 'disabled') {
          return c.json({ error: 'auth_disabled' }, 503);
        }
        try {
          await projectsService.detachRepository(
            c.req.param('id'),
            c.req.param('repoId'),
          );
          return c.body(null, 204);
        } catch (error) {
          if (error instanceof LastRepositoryError) {
            return c.json({ error: 'last_repository' }, 409);
          }
          if (error instanceof ProjectNotFoundError) {
            return c.json({ error: 'not_found' }, 404);
          }
          throw error;
        }
      })
  );
}

type ReachableOutcome =
  | { ok: true; repositories: GhRepositorySummary[] }
  | { ok: false; response: Response };

/**
 * Repository ids in a request body are claims; the reachable set for the
 * installation — resolved as the acting user — is what they are checked
 * against. GitHub-side failure modes map to the statuses the SPA reacts to:
 * a dead credential is a 401 (re-login), an unreachable GitHub a 502.
 */
async function listReachable(
  c: Context<AuthEnv>,
  authModule: AuthModule,
  installationId: string,
): Promise<ReachableOutcome> {
  if (authModule.mode === 'disabled') {
    return { ok: false, response: c.json({ error: 'auth_disabled' }, 503) };
  }
  try {
    const result = await reachableRepositories(
      authModule,
      c.get('account').id,
      installationId,
    );
    if (result === 'unknown_installation') {
      return {
        ok: false,
        response: c.json({ error: 'unknown_installation' }, 400),
      };
    }
    return { ok: true, repositories: result };
  } catch (error) {
    if (error instanceof GhCredentialExpiredError) {
      return {
        ok: false,
        response: c.json({ error: 'credential_expired' }, 401),
      };
    }
    console.warn(`[projects] GitHub listing failed: ${String(error)}`);
    return {
      ok: false,
      response: c.json({ error: 'github_unreachable' }, 502),
    };
  }
}

type InputsOutcome =
  | {
      ok: true;
      inputs: { id: string; fullName: string; private: boolean }[];
    }
  | { ok: false; missing: string };

function resolveInputs(
  ids: readonly string[],
  reachable: readonly GhRepositorySummary[],
): InputsOutcome {
  const byId = new Map(reachable.map((r) => [r.id, r]));
  const inputs: { id: string; fullName: string; private: boolean }[] = [];
  for (const id of ids) {
    const summary = byId.get(id);
    if (summary === undefined) return { ok: false, missing: id };
    inputs.push({
      id: summary.id,
      fullName: summary.fullName,
      private: summary.private,
    });
  }
  return { ok: true, inputs };
}

/** The two exclusivity refusals shared by create and attach. */
function refusalResponse(c: Context<AuthEnv>, error: unknown): Response | null {
  if (error instanceof DuplicateProjectNameError) {
    return c.json(
      {
        error: 'duplicate_name',
        existing: { id: error.existing.id, name: error.existing.name },
      },
      409,
    );
  }
  if (error instanceof RepositoryOwnedError) {
    return c.json(
      {
        error: 'repository_already_connected',
        repositoryId: error.repositoryId,
        owningProject: error.owningProject,
      },
      409,
    );
  }
  return null;
}
