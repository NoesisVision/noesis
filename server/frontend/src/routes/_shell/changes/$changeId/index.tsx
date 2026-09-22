import { createFileRoute } from '@tanstack/react-router';
import { OverviewView } from '#/features/changes/ui/overview/overview.tsx';
import { withViewHeader } from '#/shell/with-view-header.tsx';

export const Route = createFileRoute('/_shell/changes/$changeId/')({
  component: withViewHeader(OverviewView),
});
