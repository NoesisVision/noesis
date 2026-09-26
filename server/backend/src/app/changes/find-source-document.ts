import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import { ChangeId } from './change-id';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';
import type { SourceDocument } from './source-document';
import { SourceDocumentId } from './source-document-id';

/** One document of a change, whole. */
export const FindSourceDocument = z.object({
  change: ChangeId,
  id: SourceDocumentId,
});
export type FindSourceDocument = z.infer<typeof FindSourceDocument>;

export class FindSourceDocumentHandler implements Handler<
  FindSourceDocument,
  SourceDocument
> {
  private readonly changes: ChangesReader;

  constructor(changes: ChangesReader) {
    this.changes = changes;
  }

  /** The change is looked up first, so a missing change is the one named. */
  async handle(query: FindSourceDocument): Promise<SourceDocument> {
    const change = await getChangeOrThrow(this.changes, query.change);
    return change.sourceDocument(query.id);
  }
}
