import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import type { RouterContext } from '#/integrations/tanstack-query/root-provider';
import { routeTree } from '#/routeTree.gen';

// The context is built by the caller and shared with the QueryClientProvider
// in `main.tsx`, so route loaders and components read one QueryClient.
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
