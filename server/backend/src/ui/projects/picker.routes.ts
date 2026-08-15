import { Hono } from 'hono';
import type { AuthEnv } from '../../auth/auth.middleware.js';
import type { AuthModule } from '../../auth/auth.module.js';
import { GhCredentialExpiredError } from '../../auth/github.service.js';
import type { ProjectsService } from '../../projects/projects.service.js';
import { reachableRepositories } from './github-repos.js';

export interface PickerDeps {
  authModule: AuthModule;
  projectsService: ProjectsService;
}

/**
 * Mounted at `/ui/github` behind `requireSession`: the repo-picker source.
 * Each repository is annotated with the project that already owns it, so the
 * picker can grey it out and name the owner instead of letting the attach
 * run into the 409.
 */
export function createPickerApp(deps: PickerDeps) {
  const { authModule, projectsService } = deps;

  return new Hono<AuthEnv>().get(
    '/installations/:id/repositories',
    async (c) => {
      if (authModule.mode === 'disabled') {
        return c.json({ error: 'auth_disabled' as const }, 503);
      }
      try {
        const result = await reachableRepositories(
          authModule,
          c.get('account').id,
          c.req.param('id'),
        );
        if (result === 'unknown_installation') {
          return c.json({ error: 'unknown_installation' as const }, 404);
        }
        const repositories = [];
        for (const summary of result) {
          repositories.push({
            ...summary,
            owningProject: await projectsService.findOwningProject(summary.id),
          });
        }
        return c.json({ repositories });
      } catch (error) {
        if (error instanceof GhCredentialExpiredError) {
          return c.json({ error: 'credential_expired' as const }, 401);
        }
        console.warn(`[projects] picker listing failed: ${String(error)}`);
        return c.json({ error: 'github_unreachable' as const }, 502);
      }
    },
  );
}
