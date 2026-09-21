import { createFileRoute } from '@tanstack/react-router';
import { OverviewView } from '#/components/views/overview';
import { OVERVIEW_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(`${OVERVIEW_ROUTE.routeId}/`)({
  component: OverviewView,
});
