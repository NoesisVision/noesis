import { beforeEach, describe, expect, it } from 'bun:test';
import { Change } from '#backend/app/changes/model/change';
import { ChangeId } from '#backend/app/changes/model/change-id';
import {
  CreateChange,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import {
  CreateDesignDoc,
  DesignDoc,
  type DesignDocInput,
  type DesignDocViolation,
} from '#backend/app/changes/model/design-doc';
import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import { InvalidDesignDocError } from '#backend/app/changes/model/invalid-design-doc-error';
import {
  SourceDocument,
  CreateSourceDocument,
} from '#backend/app/changes/model/source-document';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';
import {
  decodedDesignDocFixture,
  designDocFixture,
  greenFieldDesignDocFixture,
} from '../fixtures/design-doc.fixture';
import { designDocId, sourceDocumentId } from '../fixtures/ids.fixture';

const ID = ChangeId.parse('2026-01-01-booking');

/** A design as an agent's working file holds it: everything but the id. */
const contentOf = ({ id: _id, ...content }: DesignDocInput) =>
  CreateDesignDoc.parse(content);

/** What an agent may write while nothing is scanned: every field its own, adding elements only. */
const byAgent = contentOf(greenFieldDesignDocFixture);
/** The same design, removing an element: nothing is scanned that it could remove. */
const removing = contentOf({
  ...greenFieldDesignDocFixture,
  buildingBlocks: {
    ...greenFieldDesignDocFixture.buildingBlocks,
    removed: ['building_block|sales.credit-notes.CreditNote'],
  },
});

const document = CreateSourceDocument.parse({
  title: 'Booking Rules — v2',
  date: '2026-09-18',
  content: 'A slot may be booked once.',
});

let change: Change;

beforeEach(() => {
  change = Change.create(
    ID,
    CreateChange.parse({ name: 'Booking', type: 'feature' }),
  );
});

/** The rules a refused write broke; throws when the write went through. */
function brokenRules(write: () => unknown): DesignDocViolation['reason'][] {
  try {
    write();
  } catch (error) {
    if (!(error instanceof InvalidDesignDocError)) throw error;
    return [...new Set(error.violations.map((v) => v.reason))];
  }
  throw new Error('expected the write to be refused');
}

describe('A new change', () => {
  it('starts in discovery at version 0, owning nothing', () => {
    expect(change.toSnapshot()).toEqual({
      id: ID,
      name: 'Booking',
      key: '',
      type: 'feature',
      status: 'discovery',
      description: '',
      version: 0,
      designDocs: [],
      sourceDocuments: [],
    });
  });
});

describe('A change read from a snapshot', () => {
  it('leaves the snapshot it was read from as it was', () => {
    const snapshot = change.toSnapshot();
    const read = Change.fromSnapshot(snapshot);

    read.addSourceDocument(document);

    expect(snapshot.sourceDocuments).toEqual([]);
    expect(read.toSnapshot().sourceDocuments).toHaveLength(1);
  });
});

describe('Updating a change', () => {
  it('replaces what it says of itself, keeping its id and what it owns', () => {
    change.addSourceDocument(document);

    change.update(
      UpdateChange.parse({
        name: 'Bookings',
        type: 'improvement',
        status: 'design',
      }),
    );

    expect(change.summary()).toEqual({
      id: ID,
      name: 'Bookings',
      key: '',
      type: 'improvement',
      status: 'design',
      description: '',
    });
    expect(change.sourceDocumentSummaries()).toHaveLength(1);
  });
});

describe('Adding a design document', () => {
  it('mints a UUID for its id', () => {
    const added = change.addDesignDoc(byAgent);

    expect(DesignDocId.safeParse(added.id).success).toBe(true);
    expect(change.designDoc(added.id)).toEqual(
      DesignDoc.parse({ ...greenFieldDesignDocFixture, id: added.id }),
    );
  });

  it('mints a new id on every add, even for the same name', () => {
    const first = change.addDesignDoc(byAgent);

    expect(change.addDesignDoc(byAgent).id).not.toBe(first.id);
    expect(change.designDocSummaries()).toHaveLength(2);
  });

  it('refuses a design that modifies or removes an element, as nothing is scanned yet', () => {
    expect(brokenRules(() => change.addDesignDoc(removing))).toEqual([
      'changedInGreenField',
    ]);
    expect(change.designDocSummaries()).toEqual([]);
  });

  it('refuses a field a human wrote, adding nothing', () => {
    const withHumanField = contentOf({
      ...greenFieldDesignDocFixture,
      modules: {
        added: [
          {
            id: 'module|sales.refunds',
            name: { value: 'refunds' },
            description: { value: 'Money back.', author: 'human' },
          },
        ],
      },
    });

    expect(brokenRules(() => change.addDesignDoc(withHumanField))).toEqual([
      'humanAuthor',
    ]);
    expect(change.designDocSummaries()).toEqual([]);
  });

  it('refuses an added element with a field left unchanged, adding nothing', () => {
    const incomplete = contentOf({
      ...greenFieldDesignDocFixture,
      modules: {
        added: [{ id: 'module|sales.refunds', name: { value: 'refunds' } }],
      },
    });

    expect(brokenRules(() => change.addDesignDoc(incomplete))).toEqual([
      'unchangedFieldInAddedItem',
    ]);
    expect(change.designDocSummaries()).toEqual([]);
  });
});

describe('Revising a design document', () => {
  it('replaces it whole at its id, which a new name leaves as it was', () => {
    const { id } = change.addDesignDoc(byAgent);

    const revised = change.reviseDesignDoc(id, {
      ...byAgent,
      name: 'Refunds by line',
      implemented: true,
    });

    expect(revised).toMatchObject({
      id,
      name: 'Refunds by line',
      implemented: true,
    });
    expect(change.designDocSummaries()).toEqual([
      { id, name: 'Refunds by line', implemented: true },
    ]);
  });

  it('refuses a version that breaks the rules, keeping the one it had', () => {
    const { id } = change.addDesignDoc(byAgent);
    const before = change.designDoc(id);

    expect(brokenRules(() => change.reviseDesignDoc(id, removing))).toEqual([
      'changedInGreenField',
    ]);
    expect(change.designDoc(id)).toEqual(before);
  });

  it('refuses an id the change does not have, adding nothing', () => {
    expect(() =>
      change.reviseDesignDoc(decodedDesignDocFixture.id, byAgent),
    ).toThrow(
      expect.objectContaining({ entity: 'design document', change: ID }),
    );
    expect(change.designDocSummaries()).toEqual([]);
  });
});

describe('Reading the design documents of a change', () => {
  it('summarises them in the order they were added, each by its name and whether it is implemented', () => {
    const later = designDocId(1);
    change = Change.fromSnapshot({
      ...change.toSnapshot(),
      designDocs: [
        DesignDoc.parse({ ...designDocFixture, implemented: true }),
        DesignDoc.parse({
          ...designDocFixture,
          id: later,
          name: 'Another design',
        }),
      ],
    });

    expect(change.designDocSummaries()).toEqual([
      {
        id: decodedDesignDocFixture.id,
        name: 'Partial refunds for orders',
        implemented: true,
      },
      { id: later, name: 'Another design', implemented: false },
    ]);
  });

  it('refuses an id the change does not have', () => {
    expect(() => change.designDoc(designDocId(99))).toThrow(
      expect.objectContaining({ entity: 'design document' }),
    );
  });
});

describe('Adding a document', () => {
  it('mints a UUID for its id', () => {
    const added = change.addSourceDocument(document);

    expect(SourceDocumentId.safeParse(added.id).success).toBe(true);
    expect(added).toEqual({ id: added.id, ...document });
    expect(change.sourceDocument(added.id)).toEqual(added);
  });

  it('mints a new id on every add, even for the same title', () => {
    const first = change.addSourceDocument(document);

    expect(change.addSourceDocument(document).id).not.toBe(first.id);
    expect(change.sourceDocumentSummaries()).toHaveLength(2);
  });
});

describe('Revising a document', () => {
  it('replaces it whole at its id, which a new title leaves as it was', () => {
    const { id } = change.addSourceDocument(document);

    change.reviseSourceDocument(id, {
      ...document,
      title: 'Booking rules v3',
      content: 'A slot may be booked twice.',
    });

    expect(change.sourceDocument(id)).toMatchObject({
      title: 'Booking rules v3',
      content: 'A slot may be booked twice.',
    });
    expect(change.sourceDocumentSummaries()).toHaveLength(1);
  });

  it('refuses an id the change does not have, adding nothing', () => {
    expect(() =>
      change.reviseSourceDocument(sourceDocumentId(99), document),
    ).toThrow(
      expect.objectContaining({ entity: 'source document', change: ID }),
    );
    expect(change.sourceDocumentSummaries()).toEqual([]);
  });
});

describe('The entries of a change', () => {
  it('names its design documents, then its documents, each in the order they were added', () => {
    const doc = (id: string, title: string) =>
      SourceDocument.parse({ id, title, date: '2026-01-01', content: '' });
    change = Change.fromSnapshot({
      ...change.toSnapshot(),
      sourceDocuments: [
        doc(sourceDocumentId(2), 'Notes'),
        doc(sourceDocumentId(1), 'Interview'),
      ],
      designDocs: [
        DesignDoc.parse({
          ...designDocFixture,
          id: designDocId(1),
          name: 'Retry flow',
        }),
      ],
    });

    expect(
      change
        .entries()
        .map((entry) =>
          [
            entry.kind,
            entry.id,
            entry.kind === 'design-doc' ? entry.name : entry.title,
          ].join(' '),
        ),
    ).toEqual([
      `design-doc ${designDocId(1)} Retry flow`,
      `source-document ${sourceDocumentId(2)} Notes`,
      `source-document ${sourceDocumentId(1)} Interview`,
    ]);
  });

  it('says of each design document whether it is implemented', () => {
    const { id } = change.addDesignDoc({ ...byAgent, implemented: true });

    expect(change.entries()).toEqual([
      {
        kind: 'design-doc',
        id,
        name: 'Partial refunds for orders',
        implemented: true,
      },
    ]);
  });
});
