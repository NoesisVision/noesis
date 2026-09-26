import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';
import type { SourceDocumentsRepository } from './source-documents.repository';

/** The documents of one change. */
export const ListSourceDocumentsForChange = z.object({ change: ChangeId });
export type ListSourceDocumentsForChange = z.infer<
  typeof ListSourceDocumentsForChange
>;

/** Only reads: its dependencies are narrowed to the methods that read. */
export class ListSourceDocumentsForChangeHandler {
  private readonly docs: Pick<SourceDocumentsRepository, 'list'>;
  private readonly changes: Pick<ChangesService, 'assertExists'>;

  constructor(
    docs: Pick<SourceDocumentsRepository, 'list'>,
    changes: Pick<ChangesService, 'assertExists'>,
  ) {
    this.docs = docs;
    this.changes = changes;
  }

  /** Oldest first: the id starts with the creation date. */
  async execute(
    query: ListSourceDocumentsForChange,
  ): Promise<SourceDocumentSummary[]> {
    await this.changes.assertExists(query.change);
    return (await this.docs.list(query.change)).map(summarize);
  }
}
