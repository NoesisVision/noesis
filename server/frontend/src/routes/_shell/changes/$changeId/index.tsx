import { createFileRoute } from '@tanstack/react-router';
import { OverviewView } from '#/features/changes/ui/overview/overview.tsx';

export const Route = createFileRoute('/_shell/changes/$changeId/')({
  component: OverviewView,
});
