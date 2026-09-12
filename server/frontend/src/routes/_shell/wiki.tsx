import { createFileRoute } from '@tanstack/react-router';
import { WikiView } from '#/components/views/wiki';

export const Route = createFileRoute('/_shell/wiki')({
  staticData: { breadcrumb: ['Documentation', 'Wiki'] },
  component: WikiView,
});
