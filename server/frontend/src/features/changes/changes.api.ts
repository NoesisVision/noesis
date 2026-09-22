import { queryOptions, useQuery } from '@tanstack/react-query';
import { ApiError, api } from '#/shared/api/client.ts';
import type { Change } from '#backend/app/changes/change.ts';
import { useChangeId } from './current-change.ts';

export class ChangeNotFoundError extends Error {
  constructor(id: string) {
    super(`No change "${id}".`);
    this.name = 'ChangeNotFoundError';
  }
}

export const changesList = queryOptions({
  staleTime: 'static',
  queryKey: ['changes'] as const,
  queryFn: async ({ signal }): Promise<Change[]> => {
    const data = await api.changes.$get({}, { init: { signal } });
    return data.changes;
  },
});

export const changesNavigationList = queryOptions({
  staleTime: 'static',
  queryKey: ['changes', 'navigation'] as const,
  queryFn: async ({ signal }) => {
    const data = await api.changes.navigation.$get({}, { init: { signal } });
    return data.changes;
  },
});

export const changeById = (id: string) =>
  queryOptions({
    staleTime: 'static',
    queryKey: ['changes', id] as const,
    queryFn: async ({ signal }) => {
      try {
        const data = await api.changes[':id'].$get(
          { param: { id } },
          { init: { signal } },
        );
        return data.change;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new ChangeNotFoundError(id);
        }
        throw error;
      }
    },
    retry: false,
  });

/**
 * The open change and the list it came from. The `_shell` loader primes the
 * query, so this is a cache read: the shell gets the change and what hangs
 * under it without binding itself to a route's loader data.
 */
export function useChangeNavigation() {
  const { changeId } = useChangeId();
  const { data: changes } = useQuery(changesNavigationList);
  const activeChange =
    changes?.find((change) => change.slug === changeId) ?? changes?.[0] ?? null;
  return { changes: changes ?? [], activeChange };
}
