import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedRepository } from '#backend/app/changes/change-owned.repository';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { createAtFreeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { type DesignDocument, DesignDocumentContent } from './design-doc';
import { DesignDocId } from './design-doc-id';
import { type DesignDocSummary, summarize } from './design-doc-summary';
import { assertDesignDocFollowsRules } from './invalid-design-doc-error';

/** A new design document for the change. `designDoc` is the working file: the server mints its id. */
export const CreateDesignDocInChange = z.object({
  change: ChangeId,
  designDoc: DesignDocumentContent,
});
export type CreateDesignDocInChange = z.infer<typeof CreateDesignDocInChange>;

export type CreateDesignDocInChangeHandler = Handler<
  CreateDesignDocInChange,
  DesignDocSummary
>;

export function createDesignDocInChangeHandler(
  designDocs: ChangeOwnedRepository<DesignDocument>,
  changes: ChangesReader,
  today: Today,
): CreateDesignDocInChangeHandler {
  return {
    /**
     * Creates the design document in the change, at an id minted from today's
     * date and its name. A name already used that day in the change gets the
     * next free suffix. Only an agent creates one, so it is held to the rules
     * an agent follows; throws `InvalidDesignDocError` when it breaks them.
     */
    async handle({ change, designDoc }) {
      await getChangeOrThrow(changes, change);
      assertDesignDocFollowsRules(designDoc, 'agent');
      const at = (id: DesignDocId): DesignDocument => ({ id, ...designDoc });
      const id = await createAtFreeSlugId(
        DesignDocId,
        designDoc.name,
        today(),
        (candidate) => designDocs.create(change, at(candidate)),
      );
      return summarize(at(id));
    },
  };
}
