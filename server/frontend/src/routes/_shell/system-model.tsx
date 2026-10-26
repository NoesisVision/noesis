import { createFileRoute } from '@tanstack/react-router';
import { systemModelSearch } from '#/features/system-model/system-model.model.ts';
import { SystemModelView } from '#/features/system-model/ui/system-model-view.tsx';

export const Route = createFileRoute('/_shell/system-model')({
  // The view heads itself: its controls share the title's line.
  component: SystemModelView,
  validateSearch: systemModelSearch,
});
