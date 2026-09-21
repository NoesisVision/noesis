import { createFileRoute } from '@tanstack/react-router';
import { WikiView } from '#/features/wiki/ui/wiki-view.tsx';

export const Route = createFileRoute('/_shell/wiki')({
  component: WikiView,
});
