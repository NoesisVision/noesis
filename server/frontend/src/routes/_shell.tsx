import { createFileRoute } from '@tanstack/react-router';
import { changesList } from '#/api/changes';
import { ShellLayout } from '#/components/shell/shell-layout';

// Loaded here so the picker never renders empty.
export const Route = createFileRoute('/_shell')({
  loader: ({ context }) => context.queryClient.query(changesList),
  component: ShellLayout,
});
