import { type ChangesRepository, isChangeSlug } from './changes.repository.js';

export class ChangeNotFoundError extends Error {
  readonly change: string;

  constructor(change: string) {
    super(`No change ${JSON.stringify(change)}.`);
    this.name = 'ChangeNotFoundError';
    this.change = change;
  }
}

export class DuplicateChangeError extends Error {
  readonly change: string;

  constructor(change: string) {
    super(`Change ${JSON.stringify(change)} already exists.`);
    this.name = 'DuplicateChangeError';
    this.change = change;
  }
}

export interface ChangeSummary {
  slug: string;
}

/** Directory semantics behind the change picker; metadata is later work. */
export class ChangesService {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  async list(): Promise<ChangeSummary[]> {
    return (await this.changes.list()).map((slug) => ({ slug }));
  }

  async create(slug: string): Promise<ChangeSummary> {
    if (!(await this.changes.create(slug))) {
      throw new DuplicateChangeError(slug);
    }
    return { slug };
  }

  /** Resolves to nothing, or throws `ChangeNotFoundError`. */
  async assertExists(change: string): Promise<void> {
    if (!isChangeSlug(change) || !(await this.changes.exists(change))) {
      throw new ChangeNotFoundError(change);
    }
  }
}
