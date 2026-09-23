import { createFileRoute } from '@tanstack/react-router';
import { DocumentView } from '#/features/documents/ui/document-view.tsx';

export const Route = createFileRoute(
  '/_shell/changes/$changeId/documents/$documentId',
)({
  component: DocumentView,
});
