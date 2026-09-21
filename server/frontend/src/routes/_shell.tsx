import { createFileRoute } from '@tanstack/react-router';
import { changesNavigationList } from '#/api/changes';
import { ShellLayout } from '#/components/shell/shell-layout';
import { SHELL_ROUTE_ID } from '#/routes/routes.ts';

// The pathless layout every view lives under. The change list is loaded here
// so the picker never renders empty; views under it read it from the cache.
export const Route = createFileRoute(SHELL_ROUTE_ID)({
  loader: ({ context }) => context.queryClient.query(changesNavigationList),
  component: ShellLayout,
});
