import { NotFoundError } from '#backend/app/not-found-error';
import { freeSlugIdAmong } from '#backend/app/slug-id';
import type { ChangeEntry } from './change-entry';
import type { ChangeId } from './change-id';
import type {
  ChangeSnapshot,
  ChangeSummary,
  CreateChange,
  UpdateChange,
} from './change-snapshot';
import {
  type CreateDesignDoc,
  DesignDoc,
  type UpdateDesignDoc,
} from './design-doc';
import { DesignDocId } from './design-doc-id';
import {
  type DesignDocSummary,
  summarize as summarizeDesignDoc,
} from './design-doc-summary';
import { InvalidDesignDocError } from './invalid-design-doc-error';
import type { SourceDocument, SourceDocumentFile } from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize as summarizeSourceDocument,
} from './source-document-summary';

/**
 * A change and the design documents and documents it owns, read and written
 * whole. It mints the ids of what it owns, so they are unique within it, and
 * holds the version it was read at, which a save checks.
 */
export class Change {
  private state: ChangeSnapshot;

  private constructor(state: ChangeSnapshot) {
    this.state = state;
  }

  static fromSnapshot(snapshot: ChangeSnapshot): Change {
    return new Change(snapshot);
  }

  /** A change not saved yet: version 0, in discovery, owning nothing. */
  static create(id: ChangeId, change: CreateChange): Change {
    return new Change({
      id,
      ...change,
      status: 'discovery',
      version: 0,
      designDocs: [],
      sourceDocuments: [],
    });
  }

  get id(): ChangeId {
    return this.state.id;
  }

  get version(): number {
    return this.state.version;
  }

  toSnapshot(): ChangeSnapshot {
    return {
      ...this.state,
      designDocs: [...this.state.designDocs],
      sourceDocuments: [...this.state.sourceDocuments],
    };
  }

  summary(): ChangeSummary {
    const { id, name, key, type, status, description } = this.state;
    return { id, name, key, type, status, description };
  }

  /** Replaces what the change says of itself; what it owns stays. */
  update(change: UpdateChange): void {
    this.state = { ...this.state, ...change };
  }

  /**
   * Adds the design document at an id minted from `today` and its name. A
   * name already used that day gets the next free suffix. Throws
   * `InvalidDesignDocError` when it breaks the rules.
   */
  addDesignDoc(document: CreateDesignDoc, today: string): DesignDoc {
    assertValid(document);
    const id = freeSlugIdAmong(
      DesignDocId,
      document.name,
      today,
      idsOf(this.state.designDocs),
    );
    const added: DesignDoc = { id, ...document };
    this.state.designDocs = [...this.state.designDocs, added];
    return added;
  }

  /** Replaces the design document at `id` whole; never adds one. */
  reviseDesignDoc(id: DesignDocId, document: UpdateDesignDoc): DesignDoc {
    this.designDoc(id);
    assertValid(document);
    const revised: DesignDoc = { id, ...document };
    this.state.designDocs = this.state.designDocs.map((doc) =>
      doc.id === id ? revised : doc,
    );
    return revised;
  }

  designDoc(id: DesignDocId): DesignDoc {
    const found = this.state.designDocs.find((doc) => doc.id === id);
    if (found === undefined) {
      throw new NotFoundError('design document', id, this.id);
    }
    return found;
  }

  /** Oldest first: the id starts with the creation date. */
  designDocSummaries(): DesignDocSummary[] {
    return byId(this.state.designDocs).map(summarizeDesignDoc);
  }

  /**
   * Adds the document at an id minted from `today` and its title. A title
   * already used that day gets the next free suffix.
   */
  addSourceDocument(
    document: SourceDocumentFile,
    today: string,
  ): SourceDocument {
    const id = freeSlugIdAmong(
      SourceDocumentId,
      document.title,
      today,
      idsOf(this.state.sourceDocuments),
    );
    const added: SourceDocument = { id, ...document };
    this.state.sourceDocuments = [...this.state.sourceDocuments, added];
    return added;
  }

  /** Replaces the document at `id` whole; never adds one. */
  reviseSourceDocument(
    id: SourceDocumentId,
    document: SourceDocumentFile,
  ): SourceDocument {
    this.sourceDocument(id);
    const revised: SourceDocument = { id, ...document };
    this.state.sourceDocuments = this.state.sourceDocuments.map((doc) =>
      doc.id === id ? revised : doc,
    );
    return revised;
  }

  sourceDocument(id: SourceDocumentId): SourceDocument {
    const found = this.state.sourceDocuments.find((doc) => doc.id === id);
    if (found === undefined) throw new NotFoundError('document', id, this.id);
    return found;
  }

  /** Oldest first: the id starts with the creation date. */
  sourceDocumentSummaries(): SourceDocumentSummary[] {
    return byId(this.state.sourceDocuments).map(summarizeSourceDocument);
  }

  /** The design documents, then the documents, each kind oldest first. */
  entries(): ChangeEntry[] {
    return [
      ...this.designDocSummaries().map((doc): ChangeEntry => ({
        kind: 'design-doc',
        ...doc,
      })),
      ...this.sourceDocumentSummaries().map((doc): ChangeEntry => ({
        kind: 'document',
        id: doc.id,
        name: doc.title,
      })),
    ];
  }
}

/** No system model is scanned yet, so every design is a green field. */
function assertValid(document: Omit<DesignDoc, 'id'>): void {
  const violations = DesignDoc.validateAgentGenerated(document);
  if (violations.length > 0) throw new InvalidDesignDocError(violations);
}

function idsOf(entities: readonly { id: string }[]): Set<string> {
  return new Set(entities.map(({ id }) => id));
}

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
function byId<T extends { id: string }>(entities: readonly T[]): T[] {
  return entities.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
