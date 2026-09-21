import { createFileRoute } from '@tanstack/react-router';
import { SystemModelView } from '#/features/system-model/ui/system-model-view.tsx';

export const Route = createFileRoute('/_shell/system-model')({
  component: SystemModelView,
});
