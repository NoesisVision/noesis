import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import { Serial } from '#backend/app/serial';
import type { Change } from './change';
import type { ChangeEntry, ChangeWithEntries } from './change-entry';
import type { ChangeId } from './change-id';
import type { ChangesRepository } from './changes.repository';

/** What an add answers: the entity as stored, and whether the id was new. */
export interface Added<T> {
  value: T;
  created: boolean;
}

export class ChangeNotFoundError extends Error {
  readonly id: ChangeId;

  constructor(id: ChangeId) {
    super(`No change ${JSON.stringify(id)}.`);
    this.name = 'ChangeNotFoundError';
    this.id = id;
  }
}

export class ChangesService {
  private readonly changes: ChangesRepository;
  private readonly designDocs: DesignDocsRepository;
  private readonly documents: DocumentsRepository;
  private readonly writes = new Serial();

  constructor(
    changes: ChangesRepository,
    designDocs: DesignDocsRepository,
    documents: DocumentsRepository,
  ) {
    this.changes = changes;
    this.designDocs = designDocs;
    this.documents = documents;
  }

  /** Newest first: the id starts with the creation date. */
  async list(): Promise<Change[]> {
    return (await this.changes.list()).reverse();
  }

  async findById(id: ChangeId): Promise<Change> {
    const found = await this.changes.get(id);
    if (found === null) throw new ChangeNotFoundError(id);
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
      // `name` is a reviewable field, so the entry gets its value.
      ...designDocs.map(({ id, name }): ChangeEntry => ({
        kind: 'design-doc',
        id,
        name: name.value,
      })),
      ...documents.map(({ id, title }): ChangeEntry => ({
        kind: 'document',
        id,
        name: title,
      })),
    ];
  }

  /**
   * Creates the change, or updates it when its id is already on disk. The
   * lookup and the write run as one step, so parallel adds agree on which
   * of them created it.
   */
  add(change: Change): Promise<Added<Change>> {
    return this.writes.run(async () => {
      const created = (await this.changes.get(change.id)) === null;
      await this.changes.save(change);
      return { value: change, created };
    });
  }

  async assertExists(id: ChangeId): Promise<void> {
    if ((await this.changes.get(id)) === null) {
      throw new ChangeNotFoundError(id);
    }
  }
}
