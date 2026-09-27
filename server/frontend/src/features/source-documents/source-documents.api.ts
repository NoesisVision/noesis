import { queryOptions } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { api } from '#/shared/api/client.ts';

export const sourceDocumentById = (change: string, id: string) =>
  queryOptions({
    queryKey: ['changes', change, 'source-documents', id] as const,
    queryFn: async ({ signal }) => {
      const data = await parseResponse(
        api.changes[':change']['source-documents'][':id'].$get(
          { param: { change, id } },
          { init: { signal } },
        ),
      );
      return data.sourceDocument;
    },
    retry: false,
  });
