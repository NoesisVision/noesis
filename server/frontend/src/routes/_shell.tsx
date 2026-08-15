import { createFileRoute, redirect } from '@tanstack/react-router';
import { ShellLayout } from '@/components/shell/shell-layout';
import { meQueryOptions, UnauthenticatedError } from '@/lib/auth';
import { projectsQueryOptions } from '@/lib/projects';

// Pathless layout route: it frames its children without adding a url segment.
export const Route = createFileRoute('/_shell')({
  // The guard sits on the layout route, so every present and future view under
  // the shell inherits it with no per-route work. `beforeLoad` runs before any
  // component mounts, so a signed-out visitor never sees a flash of chrome.
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
      // The shell reads projects with a suspense query; resolving it here
      // keeps the layout from suspending on first paint.
      await context.queryClient.ensureQueryData(projectsQueryOptions);
    } catch (error) {
      if (error instanceof UnauthenticatedError)
        throw redirect({ to: '/login' });
      throw error;
    }
  },
  component: ShellLayout,
});
