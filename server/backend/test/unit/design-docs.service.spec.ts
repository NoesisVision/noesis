import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import { DesignDocumentContent } from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import {
  DesignDocNotFoundError,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');
const ID = decodedDesignDocFixture.id;

let t: TestNoesis;
let service: DesignDocsService;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  service = t.designDocsService;
});

afterEach(() => t.cleanup());

describe('DesignDocsService', () => {
  it("lists the change's documents oldest first, by id", async () => {
    const earlier = DesignDocId.parse('2025-12-31-another-design');
    await t.writeDesignDoc(CHANGE, designDocFixture);
    await t.writeDesignDoc(CHANGE, {
      ...designDocFixture,
      id: earlier,
      name: 'Another design',
      implemented: true,
    });

    const listed = await service.list(CHANGE);
    expect(listed.map((d) => d.id)).toEqual([earlier, ID]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(
      await service.findById(CHANGE, DesignDocId.parse('2026-01-01-missing')),
    ).toBe(null);
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(service.list(NOPE)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.findById(NOPE, ID)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    // An unsafe id never reaches the service: it is not a `ChangeId`.
    expect(ChangeId.safeParse('../x').success).toBe(false);
  });
});

describe('DesignDocsService.create', () => {
  const content = DesignDocumentContent.parse(designDocFixture);

  it("mints the id from today's date and the name", async () => {
    const created = await service.create(CHANGE, content);

    const id = DesignDocId.parse('2026-09-24-partial-refunds-for-orders');
    expect(created.id).toBe(id);
    expect((await service.findById(CHANGE, id))?.document).toEqual({
      ...decodedDesignDocFixture,
      id,
    });
  });

  it('gives a name already used today in the change the next free suffix', async () => {
    await service.create(CHANGE, content);

    expect((await service.create(CHANGE, content)).id).toBe(
      DesignDocId.parse('2026-09-24-partial-refunds-for-orders-2'),
    );
  });

  it('refuses a change that has no directory', async () => {
    await expect(service.create(NOPE, content)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
  });
});

describe('DesignDocsService.update', () => {
  const content = DesignDocumentContent.parse(designDocFixture);

  it('replaces the design document at its id', async () => {
    const { id } = await service.create(CHANGE, content);

    const updated = await service.update(CHANGE, id, {
      ...content,
      implemented: true,
    });

    expect(updated).toEqual({
      id,
      name: 'Partial refunds for orders',
      implemented: true,
    });
    expect(await service.list(CHANGE)).toHaveLength(1);
  });

  it('refuses an id that names no design document in the change', async () => {
    await expect(service.update(CHANGE, ID, content)).rejects.toBeInstanceOf(
      DesignDocNotFoundError,
    );
    expect(await service.list(CHANGE)).toEqual([]);
  });
});
