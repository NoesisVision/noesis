import { createFileRoute } from '@tanstack/react-router';
import { DesignDocDetailView } from '#/components/views/design-docs';

export const Route = createFileRoute(
  '/_shell/changes/$changeId/design-docs/$docId',
)({
  component: DesignDocDetailView,
});
