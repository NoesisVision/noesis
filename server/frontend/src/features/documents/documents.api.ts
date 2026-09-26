import { queryOptions } from '@tanstack/react-query';
import { api } from '#/shared/api/client.ts';

export const documentsList = (change: string | null) =>
  queryOptions({
    queryKey: ['changes', change, 'documents'] as const,
    queryFn: async ({ signal }) => {
      if (!change) {
        return null;
      }
      const data = await api.changes[':change'].documents.$get(
        { param: { change } },
        { init: { signal } },
      );
      return data.documents;
    },
  });

export const documentById = (change: string, id: string) =>
  queryOptions({
    queryKey: ['changes', change, 'documents', id] as const,
    queryFn: async ({ signal }) => {
      const data = await api.changes[':change'].documents[':id'].$get(
        { param: { change, id } },
        { init: { signal } },
      );
      return data.document;
    },
    retry: false,
  });
