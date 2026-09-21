import { createRootRouteWithContext } from '@tanstack/react-router';
import type { RouterContext } from '#/shared/query/query-client.tsx';
import { RootLayout } from '#/shell/root-layout.tsx';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
