import { createFileRoute } from '@tanstack/react-router';
import { systemModelSearch } from '#/features/system-model/system-model.model.ts';
import { SystemModelView } from '#/features/system-model/ui/system-model-view.tsx';
import { withViewHeader } from '#/shell/with-view-header.tsx';

export const Route = createFileRoute('/_shell/system-model')({
  component: withViewHeader(SystemModelView),
  validateSearch: systemModelSearch,
});
