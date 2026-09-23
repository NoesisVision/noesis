import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from '#/routeTree.gen';
import type { RouterContext } from '#/shared/query/query-client.tsx';
import { ErrorPanel } from '#/shared/ui/error-panel.tsx';
import { NotFoundPanel } from '#/shared/ui/not-found-panel.tsx';

// The caller shares the context with the QueryClientProvider so loaders and
// components read one QueryClient.
export function getRouter(context: RouterContext) {
  return createTanStackRouter({
    routeTree,
    context,
    // Every route falls back to these, the root included, so a failure nothing
    // anticipated is drawn like one that was.
    defaultErrorComponent: ErrorPanel,
    defaultNotFoundComponent: NotFoundPanel,
    // A path that matches no route is a bad address, not a missing change:
    // without this it lands on the deepest route that has a not-found of its
    // own, and `/changes/<a change that exists>/nope` says the change is gone.
    notFoundMode: 'root',
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
