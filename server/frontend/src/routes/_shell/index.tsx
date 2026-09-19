import { createFileRoute, redirect } from '@tanstack/react-router';
import { changesList } from '#/api/changes';
import { readLastChange } from '#/components/core/last-change.ts';
import { NoChangesView } from '#/components/views/no-changes';

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
