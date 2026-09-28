import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedReader } from '#backend/app/changes/change-owned.repository';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import type { DesignDocument } from './design-doc';
import { type DesignDocSummary, summarize } from './design-doc-summary';

/** The design documents of one change. */
export const ListDesignDocsInChange = z.object({ change: ChangeId });
export type ListDesignDocsInChange = z.infer<typeof ListDesignDocsInChange>;

export type ListDesignDocsInChangeHandler = Handler<
  ListDesignDocsInChange,
  DesignDocSummary[]
>;

export function listDesignDocsInChangeHandler(
  designDocs: ChangeOwnedReader<DesignDocument>,
  changes: ChangesReader,
): ListDesignDocsInChangeHandler {
  return {
    /** Oldest first: the id starts with the creation date. */
    async handle({ change }) {
      await getChangeOrThrow(changes, change);
      return (await designDocs.list(change)).map(summarize);
    },
  };
}
