import { createFileRoute } from '@tanstack/react-router';
import { changesNavigationList } from '#/api/changes';
import { ShellLayout } from '#/shell/shell-layout.tsx';

// The pathless layout every view lives under. The change list is loaded here
// so the picker never renders empty; views under it read it from the cache.
export const Route = createFileRoute('/_shell')({
  loader: ({ context }) => context.queryClient.query(changesNavigationList),
  component: ShellLayout,
});
