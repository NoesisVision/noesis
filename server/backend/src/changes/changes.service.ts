import type { Change, CreateChange } from '@repo/shared-contracts';
import {
  type ChangesRepository,
  isChangeSlug,
  slugForChange,
} from './changes.repository.js';

export class ChangeNotFoundError extends Error {
  readonly change: string;

  constructor(change: string) {
    super(`No change ${JSON.stringify(change)}.`);
    this.name = 'ChangeNotFoundError';
    this.change = change;
  }
}

export type DuplicateChangeField = 'slug' | 'key';

export class DuplicateChangeError extends Error {
  readonly change: string;
  /** Which of the two unique things was taken. */
  readonly field: DuplicateChangeField;

  constructor(change: string, field: DuplicateChangeField = 'slug') {
    super(
      field === 'key'
        ? `A change with key ${JSON.stringify(change)} already exists.`
        : `Change ${JSON.stringify(change)} already exists.`,
    );
    this.name = 'DuplicateChangeError';
    this.change = change;
    this.field = field;
  }
}

/**
 * The changes of this checkout: directories under `.noesis/changes/`, each
 * with its `change.json`. Creation derives the slug from the name and refuses
 * a slug or key that is taken; the list is newest first.
 */
export class ChangesService {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  /** Newest first, then by slug for a stable order between equal stamps. */
  async list(): Promise<Change[]> {
    const slugs = await this.changes.list();
    const changes = await Promise.all(
      slugs.map((slug) => this.changes.readMetadata(slug)),
    );
    return changes
      .filter((change): change is Change => change !== null)
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) ||
          a.slug.localeCompare(b.slug),
      );
  }

  async findById(change: string): Promise<Change> {
    const found = isChangeSlug(change)
      ? await this.changes.readMetadata(change)
      : null;
    if (found === null) throw new ChangeNotFoundError(change);
    return found;
  }

  async create(input: CreateChange, now = new Date()): Promise<Change> {
    const slug = slugForChange(input.name);
    if (input.key !== '') {
      const taken = (await this.list()).some((c) => c.key === input.key);
      if (taken) throw new DuplicateChangeError(input.key, 'key');
    }
    if (!(await this.changes.create(slug))) {
      throw new DuplicateChangeError(slug, 'slug');
    }
    const change: Change = {
      slug,
      name: input.name,
      key: input.key,
      type: input.type,
      status: 'discovery',
      created_at: now.toISOString(),
      description: '',
    };
    await this.changes.writeMetadata(change);
    return change;
  }

  /** Resolves to nothing, or throws `ChangeNotFoundError`. */
  async assertExists(change: string): Promise<void> {
    if (!isChangeSlug(change) || !(await this.changes.exists(change))) {
      throw new ChangeNotFoundError(change);
    }
  }
}
