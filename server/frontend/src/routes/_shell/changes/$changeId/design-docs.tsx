import { createFileRoute } from '@tanstack/react-router';
import { DesignDocsView } from '#/components/views/design-docs';

export const Route = createFileRoute('/_shell/changes/$changeId/design-docs')({
  component: DesignDocsView,
});
