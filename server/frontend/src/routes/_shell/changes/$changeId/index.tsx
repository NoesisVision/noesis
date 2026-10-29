import { createFileRoute } from '@tanstack/react-router';
import { OverviewView } from '#/features/changes/ui/overview/overview.tsx';
import { withViewHeader } from '#/shell/with-view-header.tsx';

export const Route = createFileRoute('/_shell/changes/$changeId/')({
  // Full width: the overview is one card down the page, its tiles in a grid.
  // Its title alone, as the system model's is.
  component: withViewHeader(OverviewView, { titleOnly: true }),
});
