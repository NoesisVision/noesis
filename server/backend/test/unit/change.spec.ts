import { beforeEach, describe, expect, it } from 'bun:test';
import { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  CreateChange,
  UpdateChange,
} from '#backend/app/changes/change-snapshot';
import {
  CreateDesignDoc,
  DesignDoc,
  type DesignDocInput,
  type DesignDocViolation,
} from '#backend/app/changes/design-doc';
import { DesignDocId } from '#backend/app/changes/design-doc-id';
import { InvalidDesignDocError } from '#backend/app/changes/invalid-design-doc-error';
import {
  SourceDocument,
  SourceDocumentFile,
} from '#backend/app/changes/source-document';
import { SourceDocumentId } from '#backend/app/changes/source-document-id';
import {
  decodedDesignDocFixture,
  designDocFixture,
  greenFieldDesignDocFixture,
} from '../fixtures/design-doc.fixture';

const TODAY = '2026-09-24';
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

const document = SourceDocumentFile.parse({
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

describe('Updating a change', () => {
  it('replaces what it says of itself, keeping its id and what it owns', () => {
    change.addSourceDocument(document, TODAY);

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
  it("mints its id from today's date and its name", () => {
    const added = change.addDesignDoc(byAgent, TODAY);

    const id = DesignDocId.parse('2026-09-24-partial-refunds-for-orders');
    expect(added.id).toBe(id);
    expect(change.designDoc(id)).toEqual(
      DesignDoc.parse({ ...greenFieldDesignDocFixture, id }),
    );
  });

  it('gives a name already used today the next free suffix, never overwriting', () => {
    change.addDesignDoc(byAgent, TODAY);

    expect(change.addDesignDoc(byAgent, TODAY).id).toBe(
      DesignDocId.parse('2026-09-24-partial-refunds-for-orders-2'),
    );
    expect(change.designDocSummaries()).toHaveLength(2);
  });

  it('refuses a design that modifies or removes an element, as nothing is scanned yet', () => {
    expect(brokenRules(() => change.addDesignDoc(removing, TODAY))).toEqual([
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

    expect(
      brokenRules(() => change.addDesignDoc(withHumanField, TODAY)),
    ).toEqual(['humanAuthor']);
    expect(change.designDocSummaries()).toEqual([]);
  });

  it('refuses an added element with a field left unchanged, adding nothing', () => {
    const incomplete = contentOf({
      ...greenFieldDesignDocFixture,
      modules: {
        added: [{ id: 'module|sales.refunds', name: { value: 'refunds' } }],
      },
    });

    expect(brokenRules(() => change.addDesignDoc(incomplete, TODAY))).toEqual([
      'unchangedFieldInAddedItem',
    ]);
    expect(change.designDocSummaries()).toEqual([]);
  });
});

describe('Revising a design document', () => {
  it('replaces it whole at its id, which a new name leaves as it was', () => {
    const { id } = change.addDesignDoc(byAgent, TODAY);

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
    const { id } = change.addDesignDoc(byAgent, TODAY);
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
  it('summarises them oldest first, each by its name and whether it is implemented', () => {
    const earlier = DesignDocId.parse('2025-12-31-another-design');
    change = Change.fromSnapshot({
      ...change.toSnapshot(),
      designDocs: [
        DesignDoc.parse({ ...designDocFixture, implemented: true }),
        DesignDoc.parse({
          ...designDocFixture,
          id: earlier,
          name: 'Another design',
        }),
      ],
    });

    expect(change.designDocSummaries()).toEqual([
      { id: earlier, name: 'Another design', implemented: false },
      {
        id: decodedDesignDocFixture.id,
        name: 'Partial refunds for orders',
        implemented: true,
      },
    ]);
  });

  it('refuses an id the change does not have', () => {
    expect(() =>
      change.designDoc(DesignDocId.parse('2026-01-01-missing')),
    ).toThrow(expect.objectContaining({ entity: 'design document' }));
  });
});

describe('Adding a document', () => {
  it("mints its id from today's date and the title, not the document's date", () => {
    const added = change.addSourceDocument(document, TODAY);

    const id = SourceDocumentId.parse('2026-09-24-booking-rules-v2');
    expect(added).toEqual({ id, ...document });
    expect(change.sourceDocument(id)).toEqual(added);
  });

  it('gives a title already used today the next free suffix', () => {
    change.addSourceDocument(document, TODAY);

    expect(change.addSourceDocument(document, TODAY).id).toBe(
      SourceDocumentId.parse('2026-09-24-booking-rules-v2-2'),
    );
  });

  it('mints the id a design document of the same name has', () => {
    const designDoc = change.addDesignDoc(
      { ...byAgent, name: document.title },
      TODAY,
    );

    expect(change.addSourceDocument(document, TODAY).id).toBe(
      SourceDocumentId.parse(designDoc.id),
    );
  });
});

describe('Revising a document', () => {
  it('replaces it whole at its id, which a new title leaves as it was', () => {
    const { id } = change.addSourceDocument(document, TODAY);

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
      change.reviseSourceDocument(
        SourceDocumentId.parse('2026-09-24-missing'),
        document,
      ),
    ).toThrow(expect.objectContaining({ entity: 'document', change: ID }));
    expect(change.sourceDocumentSummaries()).toEqual([]);
  });
});

describe('The entries of a change', () => {
  it('names its design documents, then its documents, each oldest first', () => {
    const doc = (id: string, title: string) =>
      SourceDocument.parse({ id, title, date: '2026-01-01', content: '' });
    change = Change.fromSnapshot({
      ...change.toSnapshot(),
      sourceDocuments: [
        doc('2026-01-03-notes', 'Notes'),
        doc('2026-01-02-interview', 'Interview'),
      ],
      designDocs: [
        DesignDoc.parse({
          ...designDocFixture,
          id: '2026-01-05-retry-flow',
          name: 'Retry flow',
        }),
      ],
    });

    expect(
      change.entries().map(({ kind, id, name }) => `${kind} ${id} ${name}`),
    ).toEqual([
      'design-doc 2026-01-05-retry-flow Retry flow',
      'document 2026-01-02-interview Interview',
      'document 2026-01-03-notes Notes',
    ]);
  });

  it('says of each design document whether it is implemented', () => {
    change.addDesignDoc({ ...byAgent, implemented: true }, TODAY);

    expect(change.entries()).toEqual([
      {
        kind: 'design-doc',
        id: DesignDocId.parse('2026-09-24-partial-refunds-for-orders'),
        name: 'Partial refunds for orders',
        implemented: true,
      },
    ]);
  });
});
