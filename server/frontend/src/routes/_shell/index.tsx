import { createFileRoute, redirect } from '@tanstack/react-router';
import { changesList } from '#/features/changes/changes.api.ts';
import { readLastChange } from '#/features/changes/current-change.ts';
import { NoChangesView } from '#/features/changes/ui/no-changes.tsx';

// `/` lands on the last-opened change when it still exists, else the first
// in the list; with no change at all it is the empty state.
export const Route = createFileRoute('/_shell/')({
  beforeLoad: async ({ context }) => {
    const changes = await context.queryClient.query(changesList);
    const last = readLastChange();
    const target = changes.find((c) => c.slug === last) ?? changes[0];
    if (target) {
      throw redirect({
        to: '/changes/$changeId',
        params: { changeId: target.slug },
        replace: true,
      });
    }
  },
  component: NoChangesView,
});
