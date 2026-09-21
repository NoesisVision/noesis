import { createFileRoute } from '@tanstack/react-router';
import { DesignDocsView } from '#/components/views/design-docs';
import { DESIGN_DOCS_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(`${DESIGN_DOCS_ROUTE.routeId}/`)({
  component: DesignDocsView,
});
