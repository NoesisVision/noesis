import { createFileRoute } from '@tanstack/react-router';
import { DesignDocView } from '#/features/design-docs/ui/design-doc-view.tsx';

export const Route = createFileRoute(
  '/_shell/changes/$changeId/design-docs/$docId',
)({
  component: DesignDocView,
});
