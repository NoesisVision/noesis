import { queryOptions } from '@tanstack/react-query';
import { api } from '#/shared/api/client.ts';
import { outlineOf } from './design-doc-outline.ts';

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
 * The document with its outline beside it: the tree the reader navigates by
 * and the bodies it opens are one snapshot, and asking twice would give them
 * two. The tree is the document itself rebuilt, so it is projected here, once
 * per answer, rather than on every render of the page that reads it.
 */
export const designDocById = (change: string, id: string) =>
  queryOptions({
    queryKey: ['changes', change, 'design-docs', id] as const,
    queryFn: async ({ signal }) => {
      const detail = await api.changes[':change']['design-docs'][':id'].$get(
        { param: { change, id } },
        { init: { signal } },
      );
      return { ...detail, outline: outlineOf(detail.document) };
    },
    retry: false,
  });

/** The document as the route answers it, with the outline rebuilt beside it. */
export type DesignDocDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof designDocById>['queryFn']>>
>;
