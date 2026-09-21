import { createFileRoute } from '@tanstack/react-router';
import { DocumentsView } from '#/components/views/documents';
import { DOCUMENTS_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(DOCUMENTS_ROUTE.routeId)({
  component: DocumentsView,
});
