import type { Change, CreateChange } from '#backend/app/changes/model/change';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import { Serial } from '#backend/app/serial';
import { ChangeSlug } from './change-slug';
import type { ChangesRepository } from './changes.repository';

export interface ChangeNavigationItem extends Change {
  designDocs: { id: string; name: string }[];
}

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
  readonly value: string;
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

export class ChangesService {
  private readonly changes: ChangesRepository;
  private readonly designDocs: DesignDocsRepository;
  private readonly writes = new Serial();

  constructor(changes: ChangesRepository, designDocs: DesignDocsRepository) {
    this.changes = changes;
    this.designDocs = designDocs;
  }

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

  /** What the sidebar renders: every change, each naming the documents under it. */
  async listNavigation(): Promise<ChangeNavigationItem[]> {
    const changes = await this.list();
    return Promise.all(changes.map((change) => this.withDesignDocs(change)));
  }

  private async withDesignDocs(change: Change): Promise<ChangeNavigationItem> {
    const designDocs = await Array.fromAsync(
      this.designDocs.values(ChangeSlug.parse(change.slug)),
      ({ id, name }) => ({ id, name }),
    );
    return { ...change, designDocs: designDocs.sort(byName) };
  }

  /** Check and write run as one step, so parallel creates cannot both pass the check. */
  create(input: CreateChange, now = new Date()): Promise<Change> {
    return this.writes.run(() => this.createUnguarded(input, now));
  }

  private async createUnguarded(
    input: CreateChange,
    now: Date,
  ): Promise<Change> {
    const slug = ChangeSlug.fromName(input.name);
    await this.assertKeyFree(input.key);
    await this.assertSlugFree(slug);
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

  /** An empty key means the team tracks the change nowhere, so any number of changes may have one. */
  private async assertKeyFree(key: string): Promise<void> {
    if (key === '') return;
    const taken = (await this.list()).some((c) => c.key === key);
    if (taken) throw new DuplicateChangeError(key, 'key');
  }

  private async assertSlugFree(slug: ChangeSlug): Promise<void> {
    if ((await this.changes.read(slug)) !== null) {
      throw new DuplicateChangeError(slug.value, 'slug');
    }
  }

  async assertExists(slug: ChangeSlug): Promise<void> {
    if ((await this.changes.read(slug)) === null) {
      throw new ChangeNotFoundError(slug);
    }
  }
}

function byName(
  a: { id: string; name: string },
  b: { id: string; name: string },
): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}
