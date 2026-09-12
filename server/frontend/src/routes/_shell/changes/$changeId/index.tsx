import { createFileRoute } from '@tanstack/react-router';
import { OverviewView } from '#/components/views/overview';

export const Route = createFileRoute('/_shell/changes/$changeId/')({
  staticData: { breadcrumb: ['Overview'] },
  component: OverviewView,
});
