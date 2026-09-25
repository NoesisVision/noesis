import { createFileRoute, notFound } from '@tanstack/react-router';
import {
  ChangeNotFoundError,
  changeById,
} from '#/features/changes/changes.api.ts';
import { writeLastChange } from '#/features/changes/current-change.ts';
import { ChangeNotFoundView } from '#/features/changes/ui/change-not-found.tsx';

// The change layout: loads the change once for every view under it, remembers
// it as the last opened, and turns an unknown id into a not-found view
// inside the shell.
export const Route = createFileRoute('/_shell/changes/$changeId')({
  loader: async ({ context, params }) => {
    try {
      const change = await context.queryClient.query(
        changeById(params.changeId),
      );
      writeLastChange(change.id);
      return { change };
    } catch (error) {
      if (error instanceof ChangeNotFoundError) throw notFound();
      throw error;
    }
  },
  notFoundComponent: ChangeNotFoundView,
});
