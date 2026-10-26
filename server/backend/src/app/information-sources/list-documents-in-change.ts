import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { type DocumentSummary, summarize } from './document-summary';
import type { DocumentsReader } from './documents.repository';

/** The documents of one change. */
export const ListDocumentsInChange = z.object({ change: ChangeId });
export type ListDocumentsInChange = z.infer<typeof ListDocumentsInChange>;

export type ListDocumentsInChangeHandler = Handler<
  ListDocumentsInChange,
  DocumentSummary[]
>;

export function listDocumentsInChangeHandler(
  documents: DocumentsReader,
  changes: ChangesReader,
): ListDocumentsInChangeHandler {
  return {
    /** Oldest first: the id starts with the creation date. */
    async handle({ change }) {
      await getChangeOrThrow(changes, change);
      return (await documents.list(change)).map(summarize);
    },
  };
}
