import type { Change, CreateChange } from '@repo/shared-contracts';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ApiError, api } from './client';

/** Where a change failed to be created, as the service reports it. */
export class DuplicateChangeError extends Error {
  readonly field: 'slug' | 'key';

  constructor(field: 'slug' | 'key') {
    super(
      field === 'key'
        ? 'A change with this key already exists.'
        : 'A change with this name already exists.',
    );
    this.name = 'DuplicateChangeError';
    this.field = field;
  }
}

export class ChangeNotFoundError extends Error {
  constructor(id: string) {
    super(`No change "${id}".`);
    this.name = 'ChangeNotFoundError';
  }
}

export const changesList = queryOptions({
  queryKey: ['changes'] as const,
  queryFn: async (): Promise<Change[]> =>
    (await api.get<{ changes: Change[] }>('/ui/changes')).changes,
});

export const changeById = (id: string) =>
  queryOptions({
    queryKey: ['changes', id] as const,
    queryFn: async (): Promise<Change> => {
      try {
        return (
          await api.get<{ change: Change }>(
            `/ui/changes/${encodeURIComponent(id)}`,
          )
        ).change;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new ChangeNotFoundError(id);
        }
        throw error;
      }
    },
    retry: false,
  });

/** Creates a change, refreshes the list and lands on the new change's Overview. */
export function useCreateChange() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: CreateChange): Promise<Change> => {
      try {
        return (await api.post<{ change: Change }>('/ui/changes', input))
          .change;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const { field } = error.body as { field: 'slug' | 'key' };
          throw new DuplicateChangeError(field);
        }
        throw error;
      }
    },
    onSuccess: async (change) => {
      await queryClient.invalidateQueries({ queryKey: changesList.queryKey });
      await navigate({
        to: '/changes/$changeId',
        params: { changeId: change.slug },
      });
    },
  });
}
