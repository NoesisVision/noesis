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
import { NotFoundError } from './not-found-error';
import type {
  CreateSourceDocument,
  SourceDocument,
  UpdateSourceDocument,
} from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize as summarizeSourceDocument,
} from './source-document-summary';

/**
 * A change and the design documents and source documents it owns, read and written
 * whole. It mints the ids of what it owns, so they are unique within it, and
 * holds the version it was read at, which a save checks.
 */
export class Change {
  private state: Omit<ChangeSnapshot, 'version'>;
  private storedVersion: number;

  private constructor(state: Omit<ChangeSnapshot, 'version'>, version: number) {
    this.state = state;
    this.storedVersion = version;
  }

  /** Holds a copy: the arrays it owns are replaced, never changed in place. */
  static fromSnapshot({ version, ...state }: ChangeSnapshot): Change {
    return new Change(state, version);
  }

  /** A change not saved yet: in discovery, owning nothing. */
  static create(id: ChangeId, change: CreateChange): Change {
    return new Change(
      {
        id,
        ...change,
        status: 'discovery',
        designDocs: [],
        sourceDocuments: [],
      },
      0,
    );
  }

  get id(): ChangeId {
    return this.state.id;
  }

  /** The version it was read at, or last saved as; 0 for a change never saved. */
  get version(): number {
    return this.storedVersion;
  }

  /** What a save writes: the change whole, at the version after the one read. */
  toSnapshot(): ChangeSnapshot {
    return { ...this.state, version: this.version + 1 };
  }

  /** The repository stored `toSnapshot()`: the next save builds on that version. */
  markSaved(): void {
    this.storedVersion += 1;
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
   * Adds the design document at a new id. Throws `InvalidDesignDocError` when
   * it breaks the rules.
   */
  addDesignDoc(document: CreateDesignDoc): DesignDoc {
    assertValid(document);
    const added: DesignDoc = { id: DesignDocId.generate(), ...document };
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

  /** Oldest first: each is appended when added. */
  designDocSummaries(): DesignDocSummary[] {
    return this.state.designDocs.map(summarizeDesignDoc);
  }

  /** Adds the source document at a new id. */
  addSourceDocument(document: CreateSourceDocument): SourceDocument {
    const added: SourceDocument = {
      id: SourceDocumentId.generate(),
      ...document,
    };
    this.state.sourceDocuments = [...this.state.sourceDocuments, added];
    return added;
  }

  /** Replaces the source document at `id` whole; never adds one. */
  reviseSourceDocument(
    id: SourceDocumentId,
    document: UpdateSourceDocument,
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
    if (found === undefined)
      throw new NotFoundError('source document', id, this.id);
    return found;
  }

  /** Oldest first: each is appended when added. */
  sourceDocumentSummaries(): SourceDocumentSummary[] {
    return this.state.sourceDocuments.map(summarizeSourceDocument);
  }

  /** The design documents, then the source documents, each kind oldest first. */
  entries(): ChangeEntry[] {
    return [
      ...this.designDocSummaries().map((doc): ChangeEntry => ({
        kind: 'design-doc',
        ...doc,
      })),
      ...this.sourceDocumentSummaries().map((doc): ChangeEntry => ({
        kind: 'source-document',
        ...doc,
      })),
    ];
  }
}

/** No system model is scanned yet, so every design is a green field. */
function assertValid(document: CreateDesignDoc): void {
  const violations = DesignDoc.validateAgentGenerated(document);
  if (violations.length > 0) throw new InvalidDesignDocError(violations);
}
