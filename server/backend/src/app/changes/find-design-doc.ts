import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import { ChangeId } from './change-id';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';
import type { DesignDoc } from './design-doc';
import { DesignDocId } from './design-doc-id';

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
