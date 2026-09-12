import {
  type Conversation,
  ConversationSchema,
  type Document,
  DocumentSchema,
} from '@repo/shared-contracts';
import type { ChangesRepository } from '../changes/changes.repository.js';
import { FileRepository, type StoredFile } from '../files/file-repository.js';

export type StoredConversation = StoredFile<Conversation>;
export type StoredDocument = StoredFile<Document>;

/**
 * The imported sources of one change, as files under
 * `.noesis/changes/<change>/conversations/` and `documents/`. A source is a
 * faithful record, written once at import and never rewritten; its id is a
 * hash of its content, so the same source imported twice is one file.
 */
export class ConversationsRepository {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  async write(
    change: string,
    conversation: Conversation,
  ): Promise<StoredConversation> {
    return this.files(change).write(conversation);
  }

  async findById(
    change: string,
    id: string,
  ): Promise<StoredConversation | null> {
    return this.files(change).read(id);
  }

  /** Newest first by `time`. */
  async list(change: string): Promise<StoredConversation[]> {
    const stored = await this.files(change).list();
    return stored.sort((a, b) => b.entity.time.localeCompare(a.entity.time));
  }

  private files(change: string): FileRepository<Conversation> {
    return new FileRepository<Conversation>({
      dir: this.changes.dirOf(change, 'conversations'),
      idKey: 'conversation_id',
      slugOf: (c) => c.main_topic,
      decode: (raw) => ConversationSchema.parse(raw),
    });
  }
}

export class DocumentsRepository {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  async write(change: string, document: Document): Promise<StoredDocument> {
    return this.files(change).write(document);
  }

  async findById(change: string, id: string): Promise<StoredDocument | null> {
    return this.files(change).read(id);
  }

  /** Newest first by `date`. */
  async list(change: string): Promise<StoredDocument[]> {
    const stored = await this.files(change).list();
    return stored.sort((a, b) => b.entity.date.localeCompare(a.entity.date));
  }

  private files(change: string): FileRepository<Document> {
    return new FileRepository<Document>({
      dir: this.changes.dirOf(change, 'documents'),
      idKey: 'document_id',
      slugOf: (d) => d.title,
      decode: (raw) => DocumentSchema.parse(raw),
    });
  }
}
