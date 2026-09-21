import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChangeNotFoundError, changeById } from '#/api/changes';
import { writeLastChange } from '#/components/core/last-change.ts';
import { ChangeNotFoundView } from '#/components/views/change-not-found';
import { OVERVIEW_ROUTE } from '#/routes/routes.ts';

// The change layout: loads the change once for every view under it, remembers
// it as the last opened, and turns an unknown slug into a not-found view
// inside the shell.
export const Route = createFileRoute(OVERVIEW_ROUTE.routeId)({
  loader: async ({ context, params }) => {
    try {
      const change = await context.queryClient.query(
        changeById(params.changeId),
      );
      writeLastChange(change.slug);
      return { change };
    } catch (error) {
      if (error instanceof ChangeNotFoundError) throw notFound();
      throw error;
    }
  },
  notFoundComponent: ChangeNotFoundView,
});
