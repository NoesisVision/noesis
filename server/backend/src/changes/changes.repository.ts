import { join } from 'node:path';
import { type Change, ChangeSchema } from '@repo/shared-contracts';
import { createNoesisStore } from '../files/bun-noesis-store.js';
import type { NoesisDir } from '../files/noesis-dir.js';
import type { NoesisStore } from '../files/noesis-store.js';
import { serverLogger } from '../logging/logging.js';
import { ChangeSlug } from './change-slug.js';

const log = serverLogger('changes');

type ChangesStore = NoesisStore<Change, Change, Record<never, never>>;

/**
 * The `changes` collection of `.noesis/graph/`: one object per change, keyed
 * by its slug, whose `data.json` is the `change` contract (decision 76). The
 * store validates on both sides of the disk and replaces the file atomically;
 * this class only chooses the key.
 *
 * A change owns its conversations, documents and design documents. Until
 * those repositories move onto the store as child collections, they keep
 * writing their files under the change's directory through `dirOf`, so a
 * change stays one tree: `graph/changes/<slug>/design-docs/`.
 */
export class ChangesRepository {
  private readonly store: ChangesStore;

  constructor(noesis: NoesisDir) {
    this.store = createNoesisStore({
      directory: noesis.resolve('graph', 'changes'),
      schema: ChangeSchema,
    });
  }

  /** The change's directory, or a path under it. */
  dirOf(slug: ChangeSlug, ...segments: string[]): string {
    return join(this.store.directory, slug.value, ...segments);
  }

  /**
   * The slug of every change, in no particular order; the graph sorts. A
   * key the store accepts but that is not a slug was not written by this
   * repository; it is logged and skipped.
   */
  async *keys(): AsyncIterable<ChangeSlug> {
    for await (const key of this.store.keys()) {
      const slug = ChangeSlug.tryParse(key);
      if (slug === null) {
        log.warn('skipping {key} under {directory}: not a change slug', {
          key,
          directory: this.store.directory,
        });
        continue;
      }
      yield slug;
    }
  }

  /** The change, or `null` when there is none under that slug. */
  async read(slug: ChangeSlug): Promise<Change | null> {
    return this.store.get(slug.value);
  }

  /** Creates or replaces the change's `data.json`; what it owns stays. */
  async write(change: Change): Promise<void> {
    await this.store.set(ChangeSlug.parse(change.slug).value, change);
  }
}
