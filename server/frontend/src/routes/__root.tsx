import { createRootRouteWithContext } from '@tanstack/react-router';
import { RootLayout } from '#/components/root-layout';
import type { RouterContext } from '#/shared/query/query-client.tsx';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
