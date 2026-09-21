import { createFileRoute } from '@tanstack/react-router';
import { DocumentsView } from '#/features/documents/ui/documents-view.tsx';

export const Route = createFileRoute('/_shell/changes/$changeId/documents')({
  component: DocumentsView,
});
