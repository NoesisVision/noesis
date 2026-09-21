import { createFileRoute } from '@tanstack/react-router';
import { DesignDocsView } from '#/features/design-docs/ui/design-docs-view.tsx';

export const Route = createFileRoute('/_shell/changes/$changeId/design-docs/')({
  component: DesignDocsView,
});
