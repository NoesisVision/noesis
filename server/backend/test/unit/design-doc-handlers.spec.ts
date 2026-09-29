import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  DesignDocument,
  DesignDocumentContent,
  type DesignDocumentInput,
  type DesignDocViolation,
} from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { InvalidDesignDocError } from '#backend/app/design-docs/invalid-design-doc-error';
import {
  decodedDesignDocFixture,
  designDocFixture,
  greenFieldDesignDocFixture,
  humanEditedDesignDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// The test clock reads 2026-09-24.
const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');
const MINTED = DesignDocId.parse('2026-09-24-partial-refunds-for-orders');
/** The fixture's own id, as it is stored. */
const STORED = decodedDesignDocFixture.id;

/** A design as an agent's working file holds it: everything but the id. */
const contentOf = ({ id: _id, ...content }: DesignDocumentInput) =>
  DesignDocumentContent.parse(content);

/** What an agent may write while nothing is scanned: every field its own, adding elements only. */
const byAgent = contentOf(greenFieldDesignDocFixture);
/** The same additions with fields a human wrote in their own name. */
const byHuman = contentOf(humanEditedDesignDocFixture);
/** The same design, removing an element: nothing is scanned that it could remove. */
const removing = contentOf({
  ...greenFieldDesignDocFixture,
  buildingBlocks: {
    ...greenFieldDesignDocFixture.buildingBlocks,
    removed: ['building_block|sales.credit-notes.CreditNote'],
  },
});

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
  await t.writeChange(CHANGE);
});

afterEach(() => t.cleanup());

/** The rules a refused write broke; throws when the write went through. */
async function brokenRules(
  write: Promise<unknown>,
): Promise<DesignDocViolation['reason'][]> {
  const error = await write.then(
    () => new Error('expected the write to be refused'),
    (e: unknown) => e,
  );
  if (!(error instanceof InvalidDesignDocError)) throw error;
  return [...new Set(error.violations.map((v) => v.reason))];
}

describe('Reading the design documents of a change', () => {
  it('lists them oldest first', async () => {
    const earlier = DesignDocId.parse('2025-12-31-another-design');
    await t.writeDesignDoc(CHANGE, designDocFixture);
    await t.writeDesignDoc(CHANGE, {
      ...designDocFixture,
      id: earlier,
      name: 'Another design',
    });

    expect((await t.designDocsIn(CHANGE)).map((d) => d.id)).toEqual([
      earlier,
      STORED,
    ]);
  });

  it('summarises each by its name and whether it is implemented', async () => {
    await t.writeDesignDoc(CHANGE, { ...designDocFixture, implemented: true });

    expect(await t.designDocsIn(CHANGE)).toEqual([
      { id: STORED, name: 'Partial refunds for orders', implemented: true },
    ]);
  });

  it('finds one whole, and refuses an id the change does not have', async () => {
    await t.writeDesignDoc(CHANGE, designDocFixture);

    expect(
      await t.findDesignDoc.handle({ change: CHANGE, id: STORED }),
    ).toEqual(decodedDesignDocFixture);
    await expect(
      t.findDesignDoc.handle({
        change: CHANGE,
        id: DesignDocId.parse('2026-01-01-missing'),
      }),
    ).rejects.toMatchObject({ entity: 'design document' });
  });
});

describe('Every operation on design documents', () => {
  it('refuses a change that does not exist', async () => {
    await expect(t.designDocsIn(NOPE)).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(
      t.findDesignDoc.handle({ change: NOPE, id: STORED }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(
      t.createDesignDocInChange.handle({ change: NOPE, designDoc: byAgent }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(
      t.updateDesignDocInChange.handle({
        change: NOPE,
        id: STORED,
        designDoc: byAgent,
        writer: 'agent',
      }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('Creating a design document', () => {
  it("stores it at an id minted from today's date and its name", async () => {
    const created = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    expect(created.id).toBe(MINTED);
    expect(
      await t.findDesignDoc.handle({ change: CHANGE, id: MINTED }),
    ).toEqual(
      DesignDocument.parse({ ...greenFieldDesignDocFixture, id: MINTED }),
    );
  });

  it('gives a name already used today the next free suffix, never overwriting', async () => {
    await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    expect(
      (
        await t.createDesignDocInChange.handle({
          change: CHANGE,
          designDoc: byAgent,
        })
      ).id,
    ).toBe(DesignDocId.parse('2026-09-24-partial-refunds-for-orders-2'));
    expect(await t.designDocsIn(CHANGE)).toHaveLength(2);
  });

  it('refuses a design that modifies or removes an element, as nothing is scanned yet', async () => {
    expect(
      await brokenRules(
        t.createDesignDocInChange.handle({
          change: CHANGE,
          designDoc: removing,
        }),
      ),
    ).toEqual(['changedInGreenField']);
    expect(await t.designDocsIn(CHANGE)).toEqual([]);
  });

  it('refuses a field a human wrote, storing nothing', async () => {
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
      await brokenRules(
        t.createDesignDocInChange.handle({
          change: CHANGE,
          designDoc: withHumanField,
        }),
      ),
    ).toEqual(['humanAuthor']);
    expect(await t.designDocsIn(CHANGE)).toEqual([]);
  });

  it('refuses an added element with a field left unchanged, storing nothing', async () => {
    const incomplete = contentOf({
      ...greenFieldDesignDocFixture,
      modules: {
        added: [{ id: 'module|sales.refunds', name: { value: 'refunds' } }],
      },
    });

    expect(
      await brokenRules(
        t.createDesignDocInChange.handle({
          change: CHANGE,
          designDoc: incomplete,
        }),
      ),
    ).toEqual(['unchangedFieldInAddedItem']);
    expect(await t.designDocsIn(CHANGE)).toEqual([]);
  });
});

describe('Updating a design document', () => {
  it('replaces it whole at its id', async () => {
    const { id } = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    const updated = await t.updateDesignDocInChange.handle({
      change: CHANGE,
      id,
      designDoc: { ...byAgent, implemented: true },
      writer: 'agent',
    });

    expect(updated).toEqual({
      id,
      name: 'Partial refunds for orders',
      implemented: true,
    });
    expect(await t.designDocsIn(CHANGE)).toHaveLength(1);
  });

  it('keeps its id when the name changes', async () => {
    const { id } = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    const renamed = await t.updateDesignDocInChange.handle({
      change: CHANGE,
      id,
      designDoc: { ...byAgent, name: 'Refunds by line' },
      writer: 'agent',
    });

    expect(renamed).toMatchObject({ id, name: 'Refunds by line' });
  });

  it('refuses a version that breaks the rules, keeping the stored one', async () => {
    const { id } = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });
    const stored = await t.findDesignDoc.handle({ change: CHANGE, id });

    expect(
      await brokenRules(
        t.updateDesignDocInChange.handle({
          change: CHANGE,
          id,
          designDoc: removing,
          writer: 'agent',
        }),
      ),
    ).toEqual(['changedInGreenField']);
    expect(await t.findDesignDoc.handle({ change: CHANGE, id })).toEqual(
      stored,
    );
  });

  it('takes the fields a human writes in their own name', async () => {
    const { id } = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    await t.updateDesignDocInChange.handle({
      change: CHANGE,
      id,
      designDoc: byHuman,
      writer: 'human',
    });

    expect(await t.findDesignDoc.handle({ change: CHANGE, id })).toEqual(
      DesignDocument.parse({ ...humanEditedDesignDocFixture, id }),
    );
  });

  it("refuses an agent writing a field in a human's name", async () => {
    const { id } = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    expect(
      await brokenRules(
        t.updateDesignDocInChange.handle({
          change: CHANGE,
          id,
          designDoc: byHuman,
          writer: 'agent',
        }),
      ),
    ).toContain('humanAuthor');
  });

  it('holds a human to the rules every design follows', async () => {
    const { id } = await t.createDesignDocInChange.handle({
      change: CHANGE,
      designDoc: byAgent,
    });

    expect(
      await brokenRules(
        t.updateDesignDocInChange.handle({
          change: CHANGE,
          id,
          designDoc: removing,
          writer: 'human',
        }),
      ),
    ).toEqual(['changedInGreenField']);
  });

  it('refuses an id the change does not have, creating nothing', async () => {
    await expect(
      t.updateDesignDocInChange.handle({
        change: CHANGE,
        id: STORED,
        designDoc: byAgent,
        writer: 'agent',
      }),
    ).rejects.toMatchObject({ entity: 'design document' });
    expect(await t.designDocsIn(CHANGE)).toEqual([]);
  });
});
