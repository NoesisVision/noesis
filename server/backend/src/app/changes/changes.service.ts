import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import { Serial } from '#backend/app/serial';
import type { Change } from './change';
import type { ChangeId } from './change-id';
import type { ChangesRepository } from './changes.repository';

/** A child of a change as the sidebar names it. */
interface ChangeNavigationChild {
  id: string;
  name: string;
}

export interface ChangeNavigationItem extends Change {
  documents: ChangeNavigationChild[];
  designDocs: ChangeNavigationChild[];
}

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
    const changes = await Array.fromAsync(this.changes.values());
    return changes.sort((a, b) => b.id.localeCompare(a.id));
  }

  async findById(id: ChangeId): Promise<Change> {
    const found = await this.changes.read(id);
    if (found === null) throw new ChangeNotFoundError(id);
    return found;
  }

  /** What the sidebar renders: every change, each naming the documents under it. */
  async listNavigation(): Promise<ChangeNavigationItem[]> {
    const changes = await this.list();
    return Promise.all(changes.map((change) => this.withChildren(change)));
  }

  private async withChildren(change: Change): Promise<ChangeNavigationItem> {
    const [documents, designDocs] = await Promise.all([
      Array.fromAsync(this.documents.values(change.id), ({ id, title }) => ({
        id,
        name: title,
      })),
      // `name` is a reviewable field now, so the sidebar gets its value.
      Array.fromAsync(this.designDocs.values(change.id), ({ id, name }) => ({
        id,
        name: name.value,
      })),
    ]);
    return {
      ...change,
      documents: documents.sort(byId),
      designDocs: designDocs.sort(byId),
    };
  }

  /**
   * Creates the change, or updates it when its id is already on disk. The
   * lookup and the write run as one step, so parallel adds agree on which
   * of them created it.
   */
  add(change: Change): Promise<Added<Change>> {
    return this.writes.run(async () => {
      const created = (await this.changes.read(change.id)) === null;
      await this.changes.write(change);
      return { value: change, created };
    });
  }

  async assertExists(id: ChangeId): Promise<void> {
    if ((await this.changes.read(id)) === null) {
      throw new ChangeNotFoundError(id);
    }
  }
}

/** Oldest first: the id starts with the creation date. */
function byId(a: ChangeNavigationChild, b: ChangeNavigationChild): number {
  return a.id.localeCompare(b.id);
}
