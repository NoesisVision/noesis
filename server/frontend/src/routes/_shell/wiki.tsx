import { createFileRoute } from '@tanstack/react-router';
import { WikiView } from '#/features/wiki/ui/wiki-view.tsx';
import { withViewHeader } from '#/shell/with-view-header.tsx';

export const Route = createFileRoute('/_shell/wiki')({
  component: withViewHeader(WikiView),
});
