import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from '#/routeTree.gen';
import type { RouterContext } from '#/shared/query/query-client.tsx';

// The caller shares the context with the QueryClientProvider so loaders and
// components read one QueryClient.
export function getRouter(context: RouterContext) {
  return createTanStackRouter({
    routeTree,
    context,
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
