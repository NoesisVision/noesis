import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { newestSystemModel } from '#/features/system-model/system-model.api.ts';
import { ApiError, api } from '#/shared/api/client.ts';
import type {
  DesignDocumentInput,
  DesignDocViolation,
} from '#backend/app/design-docs/design-doc.ts';
import {
  applyEdit,
  type DesignDocEdit,
  scannedTypeNeededBy,
} from './design-doc-edit.ts';
import { outlineOf } from './design-doc-outline.ts';
import { relationKeyOf } from './relations.ts';

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

/**
 * Saves one edit as a human. The server replaces the document whole, so the
 * edit is applied to the newest version rather than to the one on screen: what
 * an agent wrote since is kept.
 */
export function useDesignDocEdit(change: string, id: string) {
  const queryClient = useQueryClient();
  /**
   * A named slot removed from the system is written with its type. Where the
   * design leaves the type as the model has it, the newest scan is asked.
   */
  const withScannedType = async (
    edit: DesignDocEdit,
    document: DesignDocumentInput,
  ): Promise<DesignDocEdit> => {
    const key = scannedTypeNeededBy(document, edit);
    if (key === null || edit.op !== 'removeFromSystem') return edit;
    const model = await queryClient.fetchQuery(newestSystemModel);
    const relation = model?.relations.find(
      (candidate) => relationKeyOf(candidate) === key,
    );
    return relation === undefined ? edit : { ...edit, to: relation.to };
  };
  return useMutation({
    mutationFn: async (edit: DesignDocEdit) => {
      const { document } = await queryClient.fetchQuery({
        ...designDocById(change, id),
        staleTime: 0,
      });
      const {
        id: _id,
        implementedAt: _implementedAt,
        ...content
      } = applyEdit(document, await withScannedType(edit, document));
      return api.changes[':change']['design-docs'][':id'].$put({
        param: { change, id },
        json: content,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['changes', change, 'design-docs'],
      }),
  });
}

/** The rules a refused edit breaks; null when it failed for another reason. */
export function violationsIn(error: unknown): DesignDocViolation[] | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body as { error?: unknown; violations?: unknown } | null;
  return body?.error === 'invalid_design_doc' && Array.isArray(body.violations)
    ? (body.violations as DesignDocViolation[])
    : null;
}
