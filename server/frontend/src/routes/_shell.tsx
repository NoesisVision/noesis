import { createFileRoute } from '@tanstack/react-router';
import { ShellLayout } from '@/components/shell/shell-layout';

// Pathless layout route: it frames its children without adding a url segment.
export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
});
