import { join } from 'node:path';
import { type Change, ChangeSchema } from '#backend/app/changes/change';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { createNoesisStore } from '#backend/platform/files/bun-noesis-store';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import type {
  ChildHandles,
  NoesisStoreOf,
} from '#backend/platform/files/noesis-store';
import { serverLogger } from '#backend/platform/logging/logging';

const log = serverLogger('changes');

// Each is keyed by the contract's own id: `id`, `document_id`.
const CHANGE_CHILDREN = {
  'design-docs': DesignDocument,
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

  dirOf(slug: ChangeSlug): string {
    return join(this.store.directory, slug);
  }

  /** Unordered; the graph sorts. */
  async *keys(): AsyncIterable<ChangeSlug> {
    for await (const key of this.store.keys()) {
      const slug = ChangeSlug.safeParse(key);
      if (!slug.success) {
        log.warn('skipping {key} under {directory}: not a change slug', {
          key,
          directory: this.store.directory,
        });
        continue;
      }
      yield slug.data;
    }
  }

  async read(slug: ChangeSlug): Promise<Change | null> {
    return this.store.get(slug);
  }

  async *values(): AsyncIterable<Change> {
    for await (const slug of this.keys()) {
      const change = await this.read(slug);
      if (change !== null) yield change;
    }
  }

  /** What the change owns stays. */
  async write(change: Change): Promise<void> {
    await this.store.set(ChangeSlug.parse(change.slug), change);
  }

  children(slug: ChangeSlug): ChangeChildren {
    return this.store.children(slug);
  }
}
