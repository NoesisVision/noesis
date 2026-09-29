import type { DesignDocument } from '#backend/app/design-docs/design-doc';
import type { Handler } from '#backend/app/handler';
import type { Document } from '#backend/app/information-sources/document';
import type { Change } from './change';
import type { ChangeEntry, ChangeWithEntries } from './change-entry';
import type { ChangeOwnedReader } from './change-owned.repository';
import type { ChangesReader } from './changes.repository';

export type ListChangesHandler = Handler<void, ChangeWithEntries[]>;

export function listChangesHandler(
  changes: ChangesReader,
  designDocs: ChangeOwnedReader<DesignDocument>,
  documents: ChangeOwnedReader<Document>,
): ListChangesHandler {
  /** The change's design documents, then its documents, each kind oldest first. */
  async function withEntries(change: Change): Promise<ChangeWithEntries> {
    const [ownDesignDocs, ownDocuments] = await Promise.all([
      designDocs.list(change.id),
      documents.list(change.id),
    ]);
    const entries: ChangeEntry[] = [
      ...ownDesignDocs.map((doc): ChangeEntry => ({
        kind: 'design-doc',
        id: doc.id,
        name: doc.name,
      })),
      ...ownDocuments.map((doc): ChangeEntry => ({
        kind: 'document',
        id: doc.id,
        name: doc.title,
      })),
    ];
    return { ...change, entries };
  }

  return {
    /** Every change, newest first — the id starts with the creation date — each with its entries. */
    async handle() {
      const listed = (await changes.list()).toReversed();
      return Promise.all(listed.map(withEntries));
    },
  };
}
