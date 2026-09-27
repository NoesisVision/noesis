import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { UpdateDesignDoc } from '#backend/app/changes/model/design-doc';
import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import {
  type DesignDocSummary,
  summarize,
} from '#backend/app/changes/model/design-doc-summary';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new version of a design document. `designDoc` is the working file: the id travels beside it. */
export const UpdateDesignDocInChange = z.object({
  change: ChangeId,
  id: DesignDocId,
  designDoc: UpdateDesignDoc,
});
export type UpdateDesignDocInChange = z.infer<typeof UpdateDesignDocInChange>;

export type UpdateDesignDocInChangeHandler = Handler<
  UpdateDesignDocInChange,
  DesignDocSummary
>;

export function updateDesignDocInChangeHandler(
  changes: ChangesRepository,
): UpdateDesignDocInChangeHandler {
  return {
    /**
     * Replaces the design document at `id` whole; never creates one. Throws
     * `InvalidDesignDocError` when the new version breaks the rules.
     */
    async handle(command) {
      const change = await getChangeOrThrow(changes, command.change);
      const revised = change.reviseDesignDoc(command.id, command.designDoc);
      await changes.save(change);
      return summarize(revised);
    },
  };
}
