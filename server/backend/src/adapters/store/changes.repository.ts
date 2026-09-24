import { join } from 'node:path';
import { type Change, ChangeSchema } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { createNoesisStore } from '#backend/platform/files/bun-noesis-store';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import type {
  ChildHandles,
  NoesisStoreOf,
} from '#backend/platform/files/noesis-store';
import { serverLogger } from '#backend/platform/logging/logging';

const log = serverLogger('changes');

// Each is keyed by the contract's own `id`, unique within its change.
const CHANGE_CHILDREN = {
  'design-docs': DesignDocumentSchema,
  documents: DocumentSchema,
} as const;

export type ChangeChildren = ChildHandles<typeof CHANGE_CHILDREN>;

type ChangesStore = NoesisStoreOf<typeof ChangeSchema, typeof CHANGE_CHILDREN>;

export class NoesisChangesRepository implements ChangesRepository {
  private readonly store: ChangesStore;

  constructor(noesis: NoesisDir) {
    this.store = createNoesisStore({
      directory: noesis.resolve('graph', 'changes'),
      schema: ChangeSchema,
      children: CHANGE_CHILDREN,
    });
  }

  dirOf(id: ChangeId): string {
    return join(this.store.directory, id);
  }

  /** Unordered; the graph sorts. */
  async *keys(): AsyncIterable<ChangeId> {
    for await (const key of this.store.keys()) {
      const id = ChangeId.safeParse(key);
      if (!id.success) {
        log.warn('skipping {key} under {directory}: not a change id', {
          key,
          directory: this.store.directory,
        });
        continue;
      }
      yield id.data;
    }
  }

  async read(id: ChangeId): Promise<Change | null> {
    return this.store.get(id);
  }

  async *values(): AsyncIterable<Change> {
    for await (const id of this.keys()) {
      const change = await this.read(id);
      if (change !== null) yield change;
    }
  }

  /** What the change owns stays. */
  async write(change: Change): Promise<void> {
    await this.store.set(change.id, change);
  }

  children(id: ChangeId): ChangeChildren {
    return this.store.children(id);
  }
}
