import type { Change, CreateChange } from '../../shared/contracts/index.js';
import { ChangeSlug } from './change-slug.js';
import type { ChangesRepository } from './changes.repository.js';

export class ChangeNotFoundError extends Error {
  readonly slug: ChangeSlug;

  constructor(slug: ChangeSlug) {
    super(`No change ${JSON.stringify(slug.value)}.`);
    this.name = 'ChangeNotFoundError';
    this.slug = slug;
  }
}

export type DuplicateChangeField = 'slug' | 'key';

export class DuplicateChangeError extends Error {
  /** The slug or key that was taken, as `field` says. */
  readonly value: string;
  /** Which of the two unique things was taken. */
  readonly field: DuplicateChangeField;

  constructor(value: string, field: DuplicateChangeField = 'slug') {
    super(
      field === 'key'
        ? `A change with key ${JSON.stringify(value)} already exists.`
        : `Change ${JSON.stringify(value)} already exists.`,
    );
    this.name = 'DuplicateChangeError';
    this.value = value;
    this.field = field;
  }
}

/**
 * The changes of this checkout: the `changes` collection under
 * `.noesis/graph/`, one `data.json` per change. Creation derives the slug
 * from the name and refuses a slug or key that is taken; the list is newest
 * first.
 */
export class ChangesService {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  /** Newest first, then by slug for a stable order between equal stamps. */
  async list(): Promise<Change[]> {
    const changes = await Array.fromAsync(this.changes.values());
    return changes.sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) ||
        a.slug.localeCompare(b.slug),
    );
  }

  async findById(slug: ChangeSlug): Promise<Change> {
    const found = await this.changes.read(slug);
    if (found === null) throw new ChangeNotFoundError(slug);
    return found;
  }

  async create(input: CreateChange, now = new Date()): Promise<Change> {
    const slug = ChangeSlug.fromName(input.name);
    if (input.key !== '') {
      const taken = (await this.list()).some((c) => c.key === input.key);
      if (taken) throw new DuplicateChangeError(input.key, 'key');
    }
    if ((await this.changes.read(slug)) !== null) {
      throw new DuplicateChangeError(slug.value, 'slug');
    }
    const change: Change = {
      slug: slug.value,
      name: input.name,
      key: input.key,
      type: input.type,
      status: 'discovery',
      created_at: now.toISOString(),
      description: '',
    };
    await this.changes.write(change);
    return change;
  }

  /** Resolves to nothing, or throws `ChangeNotFoundError`. */
  async assertExists(slug: ChangeSlug): Promise<void> {
    if ((await this.changes.read(slug)) === null) {
      throw new ChangeNotFoundError(slug);
    }
  }
}
