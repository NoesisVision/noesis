import { createFileRoute } from '@tanstack/react-router';
import { SystemModelView } from '#/components/views/system-model';
import { SYSTEM_MODEL_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(SYSTEM_MODEL_ROUTE.routeId)({
  component: SystemModelView,
});
