import { createFileRoute } from '@tanstack/react-router';
import { SystemModelView } from '#/components/views/system-model';

export const Route = createFileRoute('/_shell/system-model')({
  component: SystemModelView,
});
