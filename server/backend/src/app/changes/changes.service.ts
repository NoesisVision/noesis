import { err, ok, type Result, ResultAsync } from 'neverthrow';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import { Serial } from '#backend/app/serial';
import { type Change, type CreateChange, startChange } from './change';
import {
  type ChangeNotFound,
  type DuplicateChange,
  duplicateChange,
} from './change-errors';
import { ChangeSlug } from './change-slug';
import type { ChangesRepository } from './changes.repository';
import { existingChange } from './existing-change';

export interface ChangeNavigationItem extends Change {
  designDocs: { id: string; name: string }[];
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

  findById(slug: ChangeSlug): ResultAsync<Change, ChangeNotFound> {
    return existingChange(this.changes, slug);
  }

  /** What the sidebar renders: every change, each naming the documents under it. */
  async listNavigation(): Promise<ChangeNavigationItem[]> {
    const changes = await this.list();
    return Promise.all(changes.map((change) => this.withDesignDocs(change)));
  }

  private async withDesignDocs(change: Change): Promise<ChangeNavigationItem> {
    const designDocs = await Array.fromAsync(
      this.designDocs.values(ChangeSlug.create(change.slug)),
      ({ id, name }) => ({ id: id.value, name: name.value }),
    );
    return { ...change, designDocs: designDocs.sort(byName) };
  }

  /** Check and write run as one step, so parallel creates cannot both pass the check. */
  create(
    input: CreateChange,
    now = new Date(),
  ): ResultAsync<Change, DuplicateChange> {
    return new ResultAsync(
      this.writes.run(() => this.createUnguarded(input, now)),
    );
  }

  private async createUnguarded(
    input: CreateChange,
    now: Date,
  ): Promise<Result<Change, DuplicateChange>> {
    const slug = ChangeSlug.fromName(input.name);
    if (await this.isKeyTaken(input.key)) {
      return err(duplicateChange('key', input.key));
    }
    if ((await this.changes.read(slug)) !== null) {
      return err(duplicateChange('slug', slug.value));
    }
    const change = startChange(slug, input, now);
    await this.changes.write(change);
    return ok(change);
  }

  /** An empty key means the team tracks the change nowhere, so any number of changes may have one. */
  private async isKeyTaken(key: string): Promise<boolean> {
    if (key === '') return false;
    for await (const change of this.changes.values()) {
      if (change.key === key) return true;
    }
    return false;
  }
}

function byName(
  a: { id: string; name: string },
  b: { id: string; name: string },
): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}
