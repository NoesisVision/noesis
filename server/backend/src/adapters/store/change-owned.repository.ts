import { join } from 'node:path';
import type { ZodType } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { changesDir } from './changes.repository';

/**
 * What a change owns, in `graph/changes/<change>/<id>.<kind>.json`. The same
 * shape serves design documents and documents; the schema and kind tell them
 * apart, so one class satisfies both repository interfaces.
 */
export class ChangeOwnedRepository<T extends { id: string }> {
  private readonly changesDir: string;
  private readonly schema: ZodType<T>;
  private readonly kind: string;

  constructor(noesis: NoesisDir, schema: ZodType<T>, kind: string) {
    this.changesDir = changesDir(noesis);
    this.schema = schema;
    this.kind = kind;
  }

  get(change: ChangeId, id: T['id']): Promise<T | null> {
    return this.owned(change).get(id);
  }

  list(change: ChangeId): Promise<T[]> {
    return this.owned(change).list();
  }

  save(change: ChangeId, entity: T): Promise<void> {
    return this.owned(change).save(entity);
  }

  private owned(change: ChangeId): JsonCollection<T> {
    return new JsonCollection(
      this.schema,
      join(this.changesDir, change),
      this.kind,
    );
  }
}
