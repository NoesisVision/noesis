import { queryOptions, useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { ApiError, api } from '#/shared/api/client.ts';
import { useChangeId } from './current-change.ts';

export class ChangeNotFoundError extends Error {
  constructor(id: string) {
    super(`No change "${id}".`);
    this.name = 'ChangeNotFoundError';
  }
}

/** Every change, newest first, each with its entries. */
export const changesList = queryOptions({
  staleTime: 'static',
  queryKey: ['changes'] as const,
  queryFn: async ({ signal }) => {
    const data = await parseResponse(
      api.changes.$get({}, { init: { signal } }),
    );
    return data.changes;
  },
});

/**
 * One change, with its design documents and documents summarised. Not
 * static, unlike the list: the agent keeps adding to a change while the page
 * is open, so the views that list what it holds refetch it as they mount.
 */
export const changeById = (id: string) =>
  queryOptions({
    queryKey: ['changes', id] as const,
    queryFn: async ({ signal }) => {
      try {
        const data = await parseResponse(
          api.changes[':id'].$get({ param: { id } }, { init: { signal } }),
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
 * The open change and the list it came from, each with its entries. The
 * `_shell` loader primes the query, so this is a cache read: the shell gets
 * the change and what hangs under it without binding itself to a route's
 * loader data.
 */
export function useChangesWithEntries() {
  const { changeId } = useChangeId();
  const { data: changes } = useQuery(changesList);
  const activeChange =
    changes?.find((change) => change.id === changeId) ?? changes?.[0] ?? null;
  return { changes: changes ?? [], activeChange };
}
