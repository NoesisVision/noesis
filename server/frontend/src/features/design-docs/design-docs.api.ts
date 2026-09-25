import { queryOptions } from '@tanstack/react-query';
import { api } from '#/shared/api/client.ts';

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

/**
 * The whole answer, not just the document: the tree the reader navigates by
 * and the bodies it opens are one snapshot, and asking twice would give them
 * two.
 */
export const designDocById = (change: string, id: string) =>
  queryOptions({
    queryKey: ['changes', change, 'design-docs', id] as const,
    queryFn: async ({ signal }) =>
      api.changes[':change']['design-docs'][':id'].$get(
        { param: { change, id } },
        { init: { signal } },
      ),
    retry: false,
  });

/** The whole of what the detail route answers: the document and its outline. */
export type DesignDocDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof designDocById>['queryFn']>>
>;
