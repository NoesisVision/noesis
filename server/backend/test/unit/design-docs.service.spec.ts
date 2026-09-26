import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  DesignDocument,
  DesignDocumentContent,
  type DesignDocumentInput,
  type DesignDocViolation,
} from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import {
  type DesignDocsService,
  InvalidDesignDocError,
} from '#backend/app/design-docs/design-docs.service';
import {
  decodedDesignDocFixture,
  designDocFixture,
  greenFieldDesignDocFixture,
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
/** The same design, removing an element: nothing is scanned that it could remove. */
const removing = contentOf({
  ...greenFieldDesignDocFixture,
  buildingBlocks: {
    ...greenFieldDesignDocFixture.buildingBlocks,
    removed: ['building_block|sales.credit-notes.CreditNote'],
  },
});

let t: TestNoesis;
let service: DesignDocsService;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  service = t.designDocsService;
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

    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([
      earlier,
      STORED,
    ]);
  });

  it('summarises each by its name and whether it is implemented', async () => {
    await t.writeDesignDoc(CHANGE, { ...designDocFixture, implemented: true });

    expect(await service.list(CHANGE)).toEqual([
      { id: STORED, name: 'Partial refunds for orders', implemented: true },
    ]);
  });

  it('finds one whole, and refuses an id the change does not have', async () => {
    await t.writeDesignDoc(CHANGE, designDocFixture);

    expect(await service.findById(CHANGE, STORED)).toEqual(
      decodedDesignDocFixture,
    );
    await expect(
      service.findById(CHANGE, DesignDocId.parse('2026-01-01-missing')),
    ).rejects.toMatchObject({ entity: 'design document' });
  });
});

describe('Every operation on design documents', () => {
  it('refuses a change that does not exist', async () => {
    await expect(service.list(NOPE)).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(service.findById(NOPE, STORED)).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(service.create(NOPE, byAgent)).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(service.update(NOPE, STORED, byAgent)).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('Creating a design document', () => {
  it("stores it at an id minted from today's date and its name", async () => {
    const created = await service.create(CHANGE, byAgent);

    expect(created.id).toBe(MINTED);
    expect(await service.findById(CHANGE, MINTED)).toEqual(
      DesignDocument.parse({ ...greenFieldDesignDocFixture, id: MINTED }),
    );
  });

  it('gives a name already used today the next free suffix, never overwriting', async () => {
    await service.create(CHANGE, byAgent);

    expect((await service.create(CHANGE, byAgent)).id).toBe(
      DesignDocId.parse('2026-09-24-partial-refunds-for-orders-2'),
    );
    expect(await service.list(CHANGE)).toHaveLength(2);
  });

  it('refuses a design that modifies or removes an element, as nothing is scanned yet', async () => {
    expect(await brokenRules(service.create(CHANGE, removing))).toEqual([
      'changedInGreenField',
    ]);
    expect(await service.list(CHANGE)).toEqual([]);
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

    expect(await brokenRules(service.create(CHANGE, withHumanField))).toEqual([
      'humanAuthor',
    ]);
    expect(await service.list(CHANGE)).toEqual([]);
  });

  it('refuses an added element with a field left unchanged, storing nothing', async () => {
    const incomplete = contentOf({
      ...greenFieldDesignDocFixture,
      modules: {
        added: [{ id: 'module|sales.refunds', name: { value: 'refunds' } }],
      },
    });

    expect(await brokenRules(service.create(CHANGE, incomplete))).toEqual([
      'unchangedFieldInAddedItem',
    ]);
    expect(await service.list(CHANGE)).toEqual([]);
  });
});

describe('Updating a design document', () => {
  it('replaces it whole at its id', async () => {
    const { id } = await service.create(CHANGE, byAgent);

    const updated = await service.update(CHANGE, id, {
      ...byAgent,
      implemented: true,
    });

    expect(updated).toEqual({
      id,
      name: 'Partial refunds for orders',
      implemented: true,
    });
    expect(await service.list(CHANGE)).toHaveLength(1);
  });

  it('keeps its id when the name changes', async () => {
    const { id } = await service.create(CHANGE, byAgent);

    const renamed = await service.update(CHANGE, id, {
      ...byAgent,
      name: 'Refunds by line',
    });

    expect(renamed).toMatchObject({ id, name: 'Refunds by line' });
  });

  it('refuses a version that breaks the rules, keeping the stored one', async () => {
    const { id } = await service.create(CHANGE, byAgent);
    const stored = await service.findById(CHANGE, id);

    expect(await brokenRules(service.update(CHANGE, id, removing))).toEqual([
      'changedInGreenField',
    ]);
    expect(await service.findById(CHANGE, id)).toEqual(stored);
  });

  it('refuses an id the change does not have, creating nothing', async () => {
    await expect(service.update(CHANGE, STORED, byAgent)).rejects.toMatchObject(
      { entity: 'design document' },
    );
    expect(await service.list(CHANGE)).toEqual([]);
  });
});
