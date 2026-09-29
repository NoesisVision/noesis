import { queryOptions } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { api } from '#/shared/api/client.ts';

export const documentById = (change: string, id: string) =>
  queryOptions({
    queryKey: ['changes', change, 'documents', id] as const,
    queryFn: async ({ signal }) => {
      const data = await parseResponse(
        api.changes[':change'].documents[':id'].$get(
          { param: { change, id } },
          { init: { signal } },
        ),
      );
      return data.document;
    },
    retry: false,
  });
