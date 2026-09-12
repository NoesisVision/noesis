import {
  type Decision,
  DecisionSchema,
  type Topic,
  TopicSchema,
} from '@repo/shared-contracts';
import { FileRepository, type StoredFile } from '../files/file-repository.js';
import type { NoesisDir } from '../files/noesis-dir.js';

export type StoredTopic = StoredFile<Topic>;
export type StoredDecision = StoredFile<Decision>;

/**
 * The wiki: `.noesis/wiki/topics/` and `.noesis/wiki/decisions/`, one file per
 * topic or decision, change-independent — the distillate accumulates across
 * every import. The topic tree is in the data (`parent_id`), so the
 * directories stay flat.
 */
export class TopicsRepository {
  private readonly files: FileRepository<Topic>;

  constructor(noesis: NoesisDir) {
    this.files = new FileRepository<Topic>({
      dir: noesis.resolve('wiki', 'topics'),
      slugOf: (t) => t.title,
      decode: (raw) => TopicSchema.parse(raw),
    });
  }

  write(topic: Topic): Promise<StoredTopic> {
    return this.files.write(topic);
  }

  findById(id: string): Promise<StoredTopic | null> {
    return this.files.read(id);
  }

  /** Sorted by title. */
  async list(): Promise<StoredTopic[]> {
    const stored = await this.files.list();
    return stored.sort((a, b) => a.entity.title.localeCompare(b.entity.title));
  }
}

export class DecisionsRepository {
  private readonly files: FileRepository<Decision>;

  constructor(noesis: NoesisDir) {
    this.files = new FileRepository<Decision>({
      dir: noesis.resolve('wiki', 'decisions'),
      slugOf: (d) => d.title,
      decode: (raw) => DecisionSchema.parse(raw),
    });
  }

  write(decision: Decision): Promise<StoredDecision> {
    return this.files.write(decision);
  }

  findById(id: string): Promise<StoredDecision | null> {
    return this.files.read(id);
  }

  /** Sorted by title. */
  async list(): Promise<StoredDecision[]> {
    const stored = await this.files.list();
    return stored.sort((a, b) => a.entity.title.localeCompare(b.entity.title));
  }
}
