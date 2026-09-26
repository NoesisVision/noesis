import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import { ChangeId } from './change-id';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';
import { UpdateDesignDoc } from './design-doc';
import { DesignDocId } from './design-doc-id';
import { type DesignDocSummary, summarize } from './design-doc-summary';

/** A new version of a design document. `designDoc` is the working file: the id travels beside it. */
export const UpdateDesignDocInChange = z.object({
  change: ChangeId,
  id: DesignDocId,
  designDoc: UpdateDesignDoc,
});
export type UpdateDesignDocInChange = z.infer<typeof UpdateDesignDocInChange>;

export class UpdateDesignDocInChangeHandler implements Handler<
  UpdateDesignDocInChange,
  DesignDocSummary
> {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  /**
   * Replaces the design document at `id` whole; never creates one. Throws
   * `InvalidDesignDocError` when the new version breaks the rules.
   */
  async handle(command: UpdateDesignDocInChange): Promise<DesignDocSummary> {
    const change = await getChangeOrThrow(this.changes, command.change);
    const revised = change.reviseDesignDoc(command.id, command.designDoc);
    await this.changes.save(change);
    return summarize(revised);
  }
}
