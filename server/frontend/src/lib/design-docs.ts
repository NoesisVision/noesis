import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client';

// All shapes are inferred from the server's handlers through `AppType`
// (decision 28): a field renamed on the server stops this app from compiling.
export type DesignDocSummary = InferResponseType<
  (typeof client.ui)['design-docs']['$get'],
  200
>['designDocs'][number];

export type DesignDocDetail = InferResponseType<
  (typeof client.ui)['design-docs'][':id']['$get'],
  200
>;

/** The portable specification as served — the document-view's input. */
export type DesignDocumentDto = DesignDocDetail['document'];

export const DESIGN_DOCS_KEY = ['ui', 'design-docs'] as const;

export function designDocsQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: [...DESIGN_DOCS_KEY, 'by-project', projectId] as const,
    queryFn: async () => {
      const response = await client.ui['design-docs'].$get({
        query: { projectId },
      });
      if (!response.ok) {
        throw new Error(
          `Could not load design documents (${response.status}).`,
        );
      }
      return (await response.json()).designDocs;
    },
  });
}

export function designDocDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...DESIGN_DOCS_KEY, id] as const,
    queryFn: async (): Promise<DesignDocDetail> => {
      const response = await client.ui['design-docs'][':id'].$get({
        param: { id },
      });
      if (!response.ok) {
        throw new Error(
          `Could not load the design document (${response.status}).`,
        );
      }
      return response.json();
    },
  });
}
