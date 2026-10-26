import { queryOptions } from '@tanstack/react-query';
import { api } from '#/shared/api/client.ts';

/** The project the server was started on; it does not change while it runs. */
export const currentProject = queryOptions({
  queryKey: ['project'] as const,
  queryFn: async ({ signal }) => {
    const data = await api.project.$get({}, { init: { signal } });
    return data.project;
  },
  staleTime: Number.POSITIVE_INFINITY,
});
