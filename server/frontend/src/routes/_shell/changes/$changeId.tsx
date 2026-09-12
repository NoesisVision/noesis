import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChangeNotFoundError, changeById } from '#/api/changes';
import { writeLastChange } from '#/components/shell/last-change';
import { ChangeNotFoundView } from '#/components/views/change-not-found';

// The change layout: loads the change once for every view under it (the
// breadcrumbs read its name from here), remembers it as the last opened, and
// turns an unknown slug into a not-found view inside the shell.
export const Route = createFileRoute('/_shell/changes/$changeId')({
  loader: async ({ context, params }) => {
    try {
      const change = await context.queryClient.ensureQueryData(
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
