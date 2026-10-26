import type { DesignDocsReader } from '#backend/app/design-docs/design-docs.repository';
import type { Handler } from '#backend/app/handler';
import type { DocumentsReader } from '#backend/app/information-sources/documents.repository';
import type { Change } from './change';
import type { ChangeEntry, ChangeWithEntries } from './change-entry';
import type { ChangesReader } from './changes.repository';

export type ListChangesWithEntriesHandler = Handler<void, ChangeWithEntries[]>;

export function listChangesWithEntriesHandler(
  changes: ChangesReader,
  designDocs: DesignDocsReader,
  documents: DocumentsReader,
): ListChangesWithEntriesHandler {
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
    /** What the sidebar renders: every change, newest first, with its entries. */
    async handle() {
      const listed = (await changes.list()).toReversed();
      return Promise.all(listed.map(withEntries));
    },
  };
}
