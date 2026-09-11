import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { ChangeNotFoundError } from '../../src/changes/changes.service.js';
import {
  type DesignDocsService,
  InvalidDesignDocumentError,
} from '../../src/design-docs/design-docs.service.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

const CHANGE = 'booking';

let t: TestNoesis;
let service: DesignDocsService;

beforeEach(async () => {
  t = await testNoesis();
  await t.changesRepository.create(CHANGE);
  service = t.designDocsService;
});

afterEach(() => t.cleanup());

describe('DesignDocsService', () => {
  it('stores a valid document under a server-minted id and reads it back whole', async () => {
    const summary = await service.create(CHANGE, designDocFixture);

    // The server mints the id — whatever the input carried is replaced.
    expect(summary.id).not.toBe(designDocFixture.id);
    expect(summary.name).toBe('Appointment booking');

    const detail = await service.findById(CHANGE, summary.id);
    expect(detail?.document).toEqual({
      ...designDocFixture,
      id: summary.id,
    });
  });

  it('rejects a document that does not parse', async () => {
    expect(service.create(CHANGE, { name: 42 })).rejects.toBeInstanceOf(
      InvalidDesignDocumentError,
    );
  });

  it('rejects a document with an integrity error, naming the issue', async () => {
    const broken = {
      ...designDocFixture,
      // Both use cases point at an application service that does not exist.
      buildingBlocks: designDocFixture.buildingBlocks.filter(
        (b) => b.id !== 'svc-booking',
      ),
    };

    expect(service.create(CHANGE, broken)).rejects.toBeInstanceOf(
      InvalidDesignDocumentError,
    );
    expect(await service.list(CHANGE)).toEqual([]);
  });

  it('creates the sample document dated today', async () => {
    const summary = await service.createSample(CHANGE);

    expect(summary.name).toBe('Appointment booking');
    expect(summary.date).toBe(new Date().toISOString().slice(0, 10));
    const listed = await service.list(CHANGE);
    expect(listed.map((d) => d.id)).toEqual([summary.id]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(await service.findById(CHANGE, 'missing')).toBe(null);
  });

  it('refuses every operation on a change that has no directory', async () => {
    expect(service.list('nope')).rejects.toBeInstanceOf(ChangeNotFoundError);
    expect(service.create('nope', designDocFixture)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    expect(service.findById('nope', 'x')).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    expect(service.delete('../x', 'x')).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
  });
});
