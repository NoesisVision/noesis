import { Hono } from 'hono';
import type { AuthEnv } from '../auth/auth.middleware.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { AuthModule } from '../auth/auth.module.js';
import { toAccountDto } from '../auth/auth.service.js';
import type { DesignDocsService } from '../design-docs/design-docs.service.js';
import type { GreetingService } from '../greeting/greeting.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { RepoAccessService } from '../projects/repo-access.service.js';
import { createDesignDocsApp } from './design-docs/design-docs.routes.js';
import { createInvitesApp } from './invites/invites.routes.js';
import { createPickerApp } from './projects/picker.routes.js';
import { createProjectsApp } from './projects/projects.routes.js';
import { createSearchApp } from './search/search.routes.js';
import type { SearchService } from './search/search.service.js';

// The module's dependency contract — the explicit allow-list of what these
// routes may touch. Nothing outside this interface is in scope for the handlers.
export interface UiDeps {
  greetingService: GreetingService;
  searchService: SearchService;
  authModule: AuthModule;
  projectsService: ProjectsService;
  designDocsService: DesignDocsService;
  /** Null in disabled auth mode — no App to check access with. */
  repoAccess: RepoAccessService | null;
}

// Endpoints under the `ui` prefix (mounted in app.ts) carry ui-session auth
// (separate from the `api` surface): `requireSession` guards the whole surface
// from the top, so a view added later is guarded by construction. The ui app
// reaches them through the typed RPC client (`hc<AppType>`), so paths need no
// shared constants — rename a route and the ui stops compiling.
export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono<AuthEnv>()
      .use('*', requireSession(deps.authModule))
      .get('/hello', (c) => c.text(deps.greetingService.getHello()))
      // The SPA's guard reads this; a 401 is what sends it to /login. Zero
      // installations is a normal signed-in state, not an error — the account
      // simply has not connected any repositories yet.
      .get('/me', async (c) => {
        const account = c.get('account');
        const installations =
          deps.authModule.mode === 'github'
            ? await deps.authModule.auth.listInstallations(account.id)
            : [];
        return c.json({
          account: toAccountDto(account),
          installations,
          authMode: deps.authModule.mode,
        });
      })
      // Comment authors and mention targets (design-doc phase 4): the
      // instance is invite-gated, so every account may comment. In disabled
      // auth mode the fixed local owner is the whole roster.
      .get('/accounts', async (c) => {
        const accounts =
          deps.authModule.mode === 'github'
            ? await deps.authModule.auth.listAccounts()
            : [toAccountDto(c.get('account'))];
        return c.json({ accounts });
      })
      .route('/search', createSearchApp({ searchService: deps.searchService }))
      .route('/invites', createInvitesApp({ authModule: deps.authModule }))
      .route(
        '/projects',
        createProjectsApp({
          authModule: deps.authModule,
          projectsService: deps.projectsService,
          repoAccess: deps.repoAccess,
        }),
      )
      .route(
        '/design-docs',
        createDesignDocsApp({ designDocsService: deps.designDocsService }),
      )
      .route(
        '/github',
        createPickerApp({
          authModule: deps.authModule,
          projectsService: deps.projectsService,
        }),
      )
  );
}
