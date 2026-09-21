import { createFileRoute } from '@tanstack/react-router';
import { DesignDocDetailView } from '#/components/views/design-docs';
import { DESIGN_DOC_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(DESIGN_DOC_ROUTE.routeId)({
  component: DesignDocDetailView,
});
