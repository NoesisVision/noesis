import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import type { DesignDoc } from '#backend/app/changes/model/design-doc';
import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import type { Handler } from '#backend/app/handler';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';

/** One design document of a change, whole. */
export const FindDesignDoc = z.object({ change: ChangeId, id: DesignDocId });
export type FindDesignDoc = z.infer<typeof FindDesignDoc>;

export class FindDesignDocHandler implements Handler<FindDesignDoc, DesignDoc> {
  private readonly changes: ChangesReader;

  constructor(changes: ChangesReader) {
    this.changes = changes;
  }

  /** The change is looked up first, so a missing change is the one named. */
  async handle(query: FindDesignDoc): Promise<DesignDoc> {
    const change = await getChangeOrThrow(this.changes, query.change);
    return change.designDoc(query.id);
  }
}
