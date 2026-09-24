import { type Change, ChangeSchema } from '#backend/app/changes/change';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** `<id>.change.json` sits beside `<id>/`, which holds what the change owns. */
export function changesDir(noesis: NoesisDir): string {
  return noesis.resolve('graph', 'changes');
}

export class NoesisChangesRepository implements ChangesRepository {
  private readonly changes: JsonCollection<Change>;

  constructor(noesis: NoesisDir) {
    this.changes = new JsonCollection(
      ChangeSchema,
      changesDir(noesis),
      'change',
    );
  }

  get(id: ChangeId): Promise<Change | null> {
    return this.changes.get(id);
  }

  list(): Promise<Change[]> {
    return this.changes.list();
  }

  save(change: Change): Promise<void> {
    return this.changes.save(change);
  }
}
