import { createFileRoute } from '@tanstack/react-router';
import { DocumentsView } from '#/components/views/documents';

export const Route = createFileRoute('/_shell/changes/$changeId/documents')({
  component: DocumentsView,
});
