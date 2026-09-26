import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeGuard } from '#backend/app/changes/changes.service';
import type { Handler } from '#backend/app/handler';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';
import type { SourceDocumentsReader } from './source-documents.repository';

/** The documents of one change. */
export const ListSourceDocumentsForChange = z.object({ change: ChangeId });
export type ListSourceDocumentsForChange = z.infer<
  typeof ListSourceDocumentsForChange
>;

export class ListSourceDocumentsForChangeHandler implements Handler<
  ListSourceDocumentsForChange,
  SourceDocumentSummary[]
> {
  private readonly docs: SourceDocumentsReader;
  private readonly changes: ChangeGuard;

  constructor(docs: SourceDocumentsReader, changes: ChangeGuard) {
    this.docs = docs;
    this.changes = changes;
  }

  /** Oldest first. */
  async handle(
    query: ListSourceDocumentsForChange,
  ): Promise<SourceDocumentSummary[]> {
    await this.changes.assertExists(query.change);
    return (await this.docs.list(query.change)).map(summarize);
  }
}
