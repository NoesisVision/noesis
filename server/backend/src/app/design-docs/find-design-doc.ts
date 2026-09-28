import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangeOwnedReader,
  getOwnedOrThrow,
} from '#backend/app/changes/change-owned.repository';
import type { ChangesReader } from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import type { DesignDocument } from './design-doc';
import { DesignDocId } from './design-doc-id';

/** One design document of a change, whole. */
export const FindDesignDoc = z.object({ change: ChangeId, id: DesignDocId });
export type FindDesignDoc = z.infer<typeof FindDesignDoc>;

export type FindDesignDocHandler = Handler<FindDesignDoc, DesignDocument>;

export function findDesignDocHandler(
  designDocs: ChangeOwnedReader<DesignDocument>,
  changes: ChangesReader,
): FindDesignDocHandler {
  return {
    handle: ({ change, id }) =>
      getOwnedOrThrow(designDocs, changes, 'design document', change, id),
  };
}
