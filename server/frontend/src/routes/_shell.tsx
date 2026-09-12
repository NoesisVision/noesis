import { createFileRoute } from '@tanstack/react-router';
import { changesList } from '#/api/changes';
import { ShellLayout } from '#/components/shell/shell-layout';

// The pathless layout every view lives under. The change list is loaded here
// so the picker never renders empty; views under it read it from the cache.
export const Route = createFileRoute('/_shell')({
  loader: ({ context }) => context.queryClient.ensureQueryData(changesList),
  component: ShellLayout,
});
