import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Change, CreateChange } from '#backend/app/changes/change.ts';
import { ApiError, api } from './client';

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
  staleTime: 'static',
  queryKey: ['changes'] as const,
  queryFn: async ({ signal }): Promise<Change[]> => {
    const data = await api.changes.$get({}, { init: { signal } });
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

export async function createChange(input: CreateChange): Promise<Change> {
  try {
    const data = await api.changes.$post({ json: input });
    return data.change;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const body = error.body;
      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        body.error === 'duplicate_change' &&
        'field' in body &&
        (body.field === 'slug' || body.field === 'key')
      ) {
        throw new DuplicateChangeError(body.field);
      }
    }
    throw error;
  }
}

export function useCreateChange() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: createChange,
    onSuccess: async (change) => {
      await queryClient.invalidateQueries({ queryKey: changesList.queryKey });
      await navigate({
        to: '/changes/$changeId',
        params: { changeId: change.slug },
      });
    },
  });
}
