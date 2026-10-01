import { rmSync } from 'node:fs';
import { join } from 'node:path';
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
  private readonly dir: string;
  private readonly changes: JsonCollection<Change>;

  constructor(noesis: NoesisDir) {
    this.dir = changesDir(noesis);
    this.changes = new JsonCollection(ChangeSchema, this.dir, 'change');
  }

  get(id: ChangeId): Promise<Change | null> {
    return this.changes.get(id);
  }

  list(): Promise<Change[]> {
    return this.changes.list();
  }

  create(change: Change): Promise<boolean> {
    return this.changes.create(change);
  }

  replace(change: Change): Promise<boolean> {
    return this.changes.replace(change);
  }

  async delete(id: ChangeId): Promise<boolean> {
    if (!(await this.changes.delete(id))) return false;
    rmSync(join(this.dir, id), { recursive: true, force: true });
    return true;
  }
}
