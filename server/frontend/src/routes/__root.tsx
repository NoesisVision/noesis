import { createRootRouteWithContext } from '@tanstack/react-router';
import { RootLayout } from '#/components/root-layout';
import type { RouterContext } from '#/integrations/tanstack-query/root-provider';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
