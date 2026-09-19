import { createFileRoute, notFound } from '@tanstack/react-router';
import { ChangeNotFoundError, changeById } from '#/api/changes';
import { writeLastChange } from '#/components/core/last-change.ts';
import { ChangeNotFoundView } from '#/components/views/change-not-found';

export const Route = createFileRoute('/_shell/changes/$changeId')({
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
