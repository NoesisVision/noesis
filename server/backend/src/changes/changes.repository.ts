import { join } from 'node:path';
import {
  type Change,
  ChangeSchema,
  ConversationSchema,
  DesignDocumentSchema,
  DocumentSchema,
} from '@repo/shared-contracts';
import { createNoesisStore } from '../files/bun-noesis-store.js';
import type { NoesisDir } from '../files/noesis-dir.js';
import type { ChildHandles, NoesisStoreOf } from '../files/noesis-store.js';
import { serverLogger } from '../logging/logging.js';
import { ChangeSlug } from './change-slug.js';

const log = serverLogger('changes');

/**
 * What a change owns, by collection name. Each is keyed by the contract's
 * own id: `id`, `conversation_id`, `document_id`.
 */
const CHANGE_CHILDREN = {
  'design-docs': DesignDocumentSchema,
  conversations: ConversationSchema,
  documents: DocumentSchema,
} as const;

export type ChangeChildren = ChildHandles<typeof CHANGE_CHILDREN>;
export type ChangeChildName = keyof ChangeChildren;

type ChangesStore = NoesisStoreOf<typeof ChangeSchema, typeof CHANGE_CHILDREN>;

/**
 * The `changes` collection of `.noesis/graph/`: one object per change, keyed
 * by its slug, whose `data.json` is the `change` contract, and under it the
 * design documents, conversations and documents the change owns (decision
 * 76). The store validates on both sides of the disk and replaces files
 * atomically; this class only chooses the key and hands out the handles on
 * a change's child collections.
 */
export class ChangesRepository {
  private readonly store: ChangesStore;

  constructor(noesis: NoesisDir) {
    this.store = createNoesisStore({
      directory: noesis.resolve('graph', 'changes'),
      schema: ChangeSchema,
      children: CHANGE_CHILDREN,
    });
  }

  /** The directory the change and everything it owns live in. */
  dirOf(slug: ChangeSlug): string {
    return join(this.store.directory, slug.value);
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

  /** Every change, in no particular order; see `keys()` for what is skipped. */
  async *values(): AsyncIterable<Change> {
    for await (const slug of this.keys()) {
      const change = await this.read(slug);
      if (change !== null) yield change;
    }
  }

  /** Creates or replaces the change's `data.json`; what it owns stays. */
  async write(change: Change): Promise<void> {
    await this.store.set(ChangeSlug.parse(change.slug).value, change);
  }

  /** Handles on the change's child collections; touches no file. */
  children(slug: ChangeSlug): ChangeChildren {
    return this.store.children(slug.value);
  }
}
