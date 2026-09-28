import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangeOwnedRepository,
  getOwnedOrThrow,
} from '#backend/app/changes/change-owned.repository';
import type { ChangesReader } from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import { type DesignDocument, DesignDocumentContent } from './design-doc';
import { DesignDocFieldAuthor } from './design-doc-field';
import { DesignDocId } from './design-doc-id';
import { type DesignDocSummary, summarize } from './design-doc-summary';
import { assertDesignDocFollowsRules } from './invalid-design-doc-error';

/**
 * A new version of a design document, by whoever writes it. `designDoc` is
 * the working file: the id travels beside it.
 */
export const UpdateDesignDocInChange = z.object({
  change: ChangeId,
  id: DesignDocId,
  designDoc: DesignDocumentContent,
  writer: DesignDocFieldAuthor,
});
export type UpdateDesignDocInChange = z.infer<typeof UpdateDesignDocInChange>;

export type UpdateDesignDocInChangeHandler = Handler<
  UpdateDesignDocInChange,
  DesignDocSummary
>;

export function updateDesignDocInChangeHandler(
  designDocs: ChangeOwnedRepository<DesignDocument>,
  changes: ChangesReader,
): UpdateDesignDocInChangeHandler {
  return {
    /**
     * Replaces the design document at `id` whole; never creates one. Throws
     * `InvalidDesignDocError` when the new version breaks the rules `writer`
     * follows.
     */
    async handle({ change, id, designDoc, writer }) {
      await getOwnedOrThrow(designDocs, changes, 'design document', change, id);
      assertDesignDocFollowsRules(designDoc, writer);
      const updated: DesignDocument = { id, ...designDoc };
      if (!(await designDocs.replace(change, updated))) {
        throw new NotFoundError('design document', id, change);
      }
      return summarize(updated);
    },
  };
}
