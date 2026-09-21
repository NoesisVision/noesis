import { createFileRoute } from '@tanstack/react-router';
import { WikiView } from '#/components/views/wiki';
import { WIKI_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(WIKI_ROUTE.routeId)({
  component: WikiView,
});
