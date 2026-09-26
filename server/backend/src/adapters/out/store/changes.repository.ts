import { Change } from '#backend/app/changes/change';
import type { ChangeId } from '#backend/app/changes/change-id';
import { ChangeSnapshot } from '#backend/app/changes/change-snapshot';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import { ConcurrentModificationError } from '#backend/app/concurrent-modification-error';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/**
 * Each change whole, with what it owns, in `graph/changes/<id>.change.json`,
 * whose version counts its saves; a change never saved is at version 0.
 *
 * A save re-reads the stored version and refuses to write over any version
 * but the one the change was read at. The check and the atomic rename after
 * it are two steps that nothing else in this process runs between, but
 * another process could: enough for the one process that serves a session,
 * and for a `git checkout` under it, not a lock across processes.
 */
export class NoesisChangesRepository implements ChangesRepository {
  private readonly changes: JsonCollection<ChangeSnapshot>;

  constructor(noesis: NoesisDir) {
    this.changes = new JsonCollection(
      ChangeSnapshot,
      noesis.resolve('graph', 'changes'),
      'change',
    );
  }

  async get(id: ChangeId): Promise<Change | null> {
    const snapshot = await this.changes.get(id);
    return snapshot === null ? null : Change.fromSnapshot(snapshot);
  }

  async list(): Promise<Change[]> {
    return (await this.changes.list()).map((snapshot) =>
      Change.fromSnapshot(snapshot),
    );
  }

  async save(change: Change): Promise<void> {
    const saved = this.changes.saveIf(
      { ...change.toSnapshot(), version: change.version + 1 },
      (stored) => (stored?.version ?? 0) === change.version,
    );
    if (!saved) throw new ConcurrentModificationError(change.id);
  }
}
