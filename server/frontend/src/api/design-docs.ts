import { queryOptions } from '@tanstack/react-query';
import { api } from './client';

export const designDocsList = (change: string | null) =>
  queryOptions({
    queryKey: ['changes', change, 'design-docs'] as const,
    queryFn: async ({ signal }) => {
      if (!change) {
        return null;
      }
      const data = await api.changes[':change']['design-docs'].$get(
        { param: { change } },
        { init: { signal } },
      );
      return data.designDocs;
    },
  });

export const designDocById = (change: string, id: string) =>
  queryOptions({
    queryKey: ['changes', change, 'design-docs', id] as const,
    queryFn: async ({ signal }) => {
      const data = await api.changes[':change']['design-docs'][':id'].$get(
        { param: { change, id } },
        { init: { signal } },
      );
      return data.document;
    },
    retry: false,
  });
