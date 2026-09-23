import { createFileRoute } from '@tanstack/react-router';
import { DocumentsView } from '#/features/documents/ui/documents-view.tsx';
import { withViewHeader } from '#/shell/with-view-header.tsx';

export const Route = createFileRoute('/_shell/changes/$changeId/documents/')({
  component: withViewHeader(DocumentsView),
});
