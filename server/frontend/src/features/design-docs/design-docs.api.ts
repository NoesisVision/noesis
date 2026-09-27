import { queryOptions } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { api } from '#/shared/api/client.ts';
import { outlineOf } from './design-doc-outline.ts';

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
      const detail = await parseResponse(
        api.changes[':change']['design-docs'][':id'].$get(
          { param: { change, id } },
          { init: { signal } },
        ),
      );
      return { ...detail, outline: outlineOf(detail.designDoc) };
    },
    retry: false,
  });

/** The document as the route answers it, with the outline rebuilt beside it. */
export type DesignDocDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof designDocById>['queryFn']>>
>;
