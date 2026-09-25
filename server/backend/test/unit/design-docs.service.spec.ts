import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import {
  DesignDocument,
  DesignDocumentContent,
  type DesignDocumentInput,
  type DesignDocViolation,
} from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import {
  DesignDocNotFoundError,
  type DesignDocsService,
  InvalidDesignDocError,
} from '#backend/app/design-docs/design-docs.service';
import {
  agentDesignDocFixture,
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// The test clock reads 2026-09-24.
const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');
const MINTED = DesignDocId.parse('2026-09-24-partial-refunds-for-orders');
/** The fixture's own id: a design document a human has already reviewed. */
const REVIEWED = decodedDesignDocFixture.id;

/** A design as an agent's working file holds it: everything but the id. */
const contentOf = ({ id: _id, ...content }: DesignDocumentInput) =>
  DesignDocumentContent.parse(content);

/** What an agent may write: every changed field is its own. */
const byAgent = contentOf(agentDesignDocFixture);
/** The reviewed design, with the fields a human wrote. */
const reviewed = contentOf(designDocFixture);

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
      REVIEWED,
    ]);
  });

  it('summarises each by its name and whether it is implemented', async () => {
    await t.writeDesignDoc(CHANGE, { ...designDocFixture, implemented: true });

    expect(await service.list(CHANGE)).toEqual([
      { id: REVIEWED, name: 'Partial refunds for orders', implemented: true },
    ]);
  });

  it('finds one whole, and nothing for an id the change does not have', async () => {
    await t.writeDesignDoc(CHANGE, designDocFixture);

    expect((await service.findById(CHANGE, REVIEWED))?.document).toEqual(
      decodedDesignDocFixture,
    );
    expect(
      await service.findById(CHANGE, DesignDocId.parse('2026-01-01-missing')),
    ).toBe(null);
  });
});

describe('Every operation on design documents', () => {
  it('refuses a change that does not exist', async () => {
    await expect(service.list(NOPE)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.findById(NOPE, REVIEWED)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.create(NOPE, byAgent)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(
      service.update(NOPE, REVIEWED, byAgent),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
  });
});

describe('Creating a design document', () => {
  it("stores it at an id minted from today's date and its name", async () => {
    const created = await service.create(CHANGE, byAgent);

    expect(created.id).toBe(MINTED);
    expect((await service.findById(CHANGE, MINTED))?.document).toEqual(
      DesignDocument.parse({ ...agentDesignDocFixture, id: MINTED }),
    );
  });

  it('gives a name already used today the next free suffix, never overwriting', async () => {
    await service.create(CHANGE, byAgent);

    expect((await service.create(CHANGE, byAgent)).id).toBe(
      DesignDocId.parse('2026-09-24-partial-refunds-for-orders-2'),
    );
    expect(await service.list(CHANGE)).toHaveLength(2);
  });

  it('refuses a design that claims a human wrote a field, storing nothing', async () => {
    expect(await brokenRules(service.create(CHANGE, reviewed))).toEqual([
      'humanAuthorClaimed',
    ]);
    expect(await service.list(CHANGE)).toEqual([]);
  });

  it('refuses an added element with a field left unchanged, storing nothing', async () => {
    const incomplete = contentOf({
      ...agentDesignDocFixture,
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

  it('accepts a version that writes back what a human wrote', async () => {
    await t.writeDesignDoc(CHANGE, designDocFixture);

    expect(await service.update(CHANGE, REVIEWED, reviewed)).toMatchObject({
      id: REVIEWED,
    });
  });

  it('refuses a version that overwrites what a human wrote, keeping the stored one', async () => {
    await t.writeDesignDoc(CHANGE, designDocFixture);

    expect(
      await brokenRules(service.update(CHANGE, REVIEWED, byAgent)),
    ).toEqual(['humanValueChanged']);
    expect((await service.findById(CHANGE, REVIEWED))?.document).toEqual(
      decodedDesignDocFixture,
    );
  });

  it('refuses an id the change does not have, creating nothing', async () => {
    await expect(
      service.update(CHANGE, REVIEWED, byAgent),
    ).rejects.toBeInstanceOf(DesignDocNotFoundError);
    expect(await service.list(CHANGE)).toEqual([]);
  });
});
