import type { DesignDocument } from '#backend/app/design-docs/design-doc';
import type { Document } from '#backend/app/information-sources/document';
import { NotFoundError } from '#backend/app/not-found-error';
import { createAtFreeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import type { Change, ChangeContent, NewChange } from './change';
import type { ChangeEntry, ChangeWithEntries } from './change-entry';
import { ChangeId } from './change-id';
import type { ChangeOwnedRepository } from './change-owned.repository';
import type { ChangesRepository } from './changes.repository';

export class ChangesService {
  private readonly changes: ChangesRepository;
  private readonly designDocs: ChangeOwnedRepository<DesignDocument>;
  private readonly documents: ChangeOwnedRepository<Document>;
  private readonly today: Today;

  constructor(
    changes: ChangesRepository,
    designDocs: ChangeOwnedRepository<DesignDocument>,
    documents: ChangeOwnedRepository<Document>,
    today: Today,
  ) {
    this.changes = changes;
    this.designDocs = designDocs;
    this.documents = documents;
    this.today = today;
  }

  /** Newest first: the id starts with the creation date. */
  async list(): Promise<Change[]> {
    return (await this.changes.list()).reverse();
  }

  async findById(id: ChangeId): Promise<Change> {
    const found = await this.changes.get(id);
    if (found === null) throw new NotFoundError('change', id);
    return found;
  }

  /** The change's design documents, then its documents, each kind oldest first. */
  async entries(id: ChangeId): Promise<ChangeEntry[]> {
    await this.assertExists(id);
    return this.entriesOf(id);
  }

  /** What the sidebar renders: every change, newest first, with its entries. */
  async listWithEntries(): Promise<ChangeWithEntries[]> {
    const changes = await this.list();
    return Promise.all(changes.map((change) => this.withEntries(change)));
  }

  private async withEntries(change: Change): Promise<ChangeWithEntries> {
    return { ...change, entries: await this.entriesOf(change.id) };
  }

  private async entriesOf(id: ChangeId): Promise<ChangeEntry[]> {
    const [designDocs, documents] = await Promise.all([
      this.designDocs.list(id),
      this.documents.list(id),
    ]);
    return [
      ...designDocs.map((doc): ChangeEntry => ({
        kind: 'design-doc',
        id: doc.id,
        name: doc.name,
      })),
      ...documents.map((doc): ChangeEntry => ({
        kind: 'document',
        id: doc.id,
        name: doc.title,
      })),
    ];
  }

  /**
   * Creates the change in discovery, at an id minted from today's date and
   * its name. A name already used that day gets the next free suffix.
   */
  async create(change: NewChange): Promise<Change> {
    const at = (id: ChangeId): Change => ({
      id,
      ...change,
      status: 'discovery',
    });
    const id = await createAtFreeSlugId(
      ChangeId,
      change.name,
      this.today(),
      (candidate) => this.changes.create(at(candidate)),
    );
    return at(id);
  }

  /** Replaces the change at `id` whole; never creates one. */
  async update(id: ChangeId, change: ChangeContent): Promise<Change> {
    const updated: Change = { id, ...change };
    if (!(await this.changes.replace(updated))) {
      throw new NotFoundError('change', id);
    }
    return updated;
  }

  async assertExists(id: ChangeId): Promise<void> {
    if ((await this.changes.get(id)) === null) {
      throw new NotFoundError('change', id);
    }
  }
}
