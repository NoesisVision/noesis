import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangeOwnedReader,
  getOwnedOrThrow,
} from '#backend/app/changes/change-owned.repository';
import type { ChangesReader } from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import type { Document } from './document';
import { DocumentId } from './document-id';

/** One document of a change, whole. */
export const FindDocument = z.object({ change: ChangeId, id: DocumentId });
export type FindDocument = z.infer<typeof FindDocument>;

export type FindDocumentHandler = Handler<FindDocument, Document>;

export function findDocumentHandler(
  documents: ChangeOwnedReader<Document>,
  changes: ChangesReader,
): FindDocumentHandler {
  return {
    handle: ({ change, id }) =>
      getOwnedOrThrow(documents, changes, 'document', change, id),
  };
}
