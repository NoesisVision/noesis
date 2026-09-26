import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import { ChangeId } from './change-id';
import { ChangeSummary } from './change-snapshot';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';
import { DesignDocSummary } from './design-doc-summary';
import { SourceDocumentSummary } from './source-document-summary';

/** One change, with what it owns summarised. */
export const FindChange = z.object({ id: ChangeId });
export type FindChange = z.infer<typeof FindChange>;

const FindChangeResult = ChangeSummary.extend({
  designDocs: z.array(DesignDocSummary),
  sourceDocuments: z.array(SourceDocumentSummary),
});
export type FindChangeResult = z.infer<typeof FindChangeResult>;

export class FindChangeHandler implements Handler<
  FindChange,
  FindChangeResult
> {
  private readonly changes: ChangesReader;

  constructor(changes: ChangesReader) {
    this.changes = changes;
  }

  /** Each kind oldest first. */
  async handle(query: FindChange): Promise<FindChangeResult> {
    const change = await getChangeOrThrow(this.changes, query.id);
    return {
      ...change.summary(),
      designDocs: change.designDocSummaries(),
      sourceDocuments: change.sourceDocumentSummaries(),
    };
  }
}
