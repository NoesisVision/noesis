import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DESIGN_DOCS_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(DESIGN_DOCS_ROUTE.routeId)({
  component: Outlet,
});
