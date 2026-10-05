import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangeOwnedRepository,
  getOwnedOrThrow,
} from '#backend/app/changes/change-owned.repository';
import type { ChangesReader } from '#backend/app/changes/changes.repository';
import type { Now } from '#backend/app/clock';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import type { SystemModelsReader } from '#backend/app/system-model/system-models.repository';
import {
  type DesignDocument,
  DesignDocumentContent,
  implementedAtOf,
} from './design-doc';
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
  systemModels: SystemModelsReader,
  now: Now,
): UpdateDesignDocInChangeHandler {
  return {
    /**
     * Replaces the design document at `id` whole; never creates one. Throws
     * `InvalidDesignDocError` when the new version breaks the rules `writer`
     * follows against the newest scan. The time it is marked implemented is the server's to keep.
     */
    async handle({ change, id, designDoc, writer }) {
      const before = await getOwnedOrThrow(
        designDocs,
        changes,
        'design document',
        change,
        id,
      );
      await assertDesignDocFollowsRules(
        designDoc,
        writer,
        systemModels,
        before,
      );
      const updated: DesignDocument = {
        id,
        ...designDoc,
        implementedAt: implementedAtOf(designDoc, before, now),
      };
      if (!(await designDocs.replace(change, updated))) {
        throw new NotFoundError('design document', id, change);
      }
      return summarize(updated);
    },
  };
}
