import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { ChangeSummary } from '#backend/app/changes/model/change-snapshot';
import { DesignDocSummary } from '#backend/app/changes/model/design-doc-summary';
import { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import type { Handler } from '#backend/app/handler';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';

/** One change, with what it owns summarised. */
export const FindChange = z.object({ id: ChangeId });
export type FindChange = z.infer<typeof FindChange>;

const FindChangeResult = ChangeSummary.extend({
  designDocs: z.array(DesignDocSummary),
  sourceDocuments: z.array(SourceDocumentSummary),
});
export type FindChangeResult = z.infer<typeof FindChangeResult>;

export function findChangeHandler(
  changes: ChangesReader,
): Handler<FindChange, FindChangeResult> {
  return {
    /** Each kind oldest first. */
    async handle(query) {
      const change = await getChangeOrThrow(changes, query.id);
      return {
        ...change.summary(),
        designDocs: change.designDocSummaries(),
        sourceDocuments: change.sourceDocumentSummaries(),
      };
    },
  };
}
