import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import {
  DesignDocsService,
  InvalidDesignDocumentError,
} from '../../src/design-docs/design-docs.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

let db: DatabaseService;
let service: DesignDocsService;

beforeAll(async () => {
  db = await sharedTestDatabase();
  service = new DesignDocsService(new DesignDocsRepository(db));
});

afterEach(resetGraph);

describe('DesignDocsService', () => {
  it('stores a valid document under a server-minted id and reads it back whole', async () => {
    const summary = await service.create(designDocFixture);

    // The server mints the id — whatever the input carried is replaced.
    expect(summary.id).not.toBe(designDocFixture.id);
    expect(summary.name).toBe('Appointment booking');

    const detail = await service.findById(summary.id);
    expect(detail?.document).toEqual({
      ...designDocFixture,
      id: summary.id,
    });
  });

  it('rejects a document that does not parse', async () => {
    expect(service.create({ name: 42 })).rejects.toBeInstanceOf(
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

    expect(service.create(broken)).rejects.toBeInstanceOf(
      InvalidDesignDocumentError,
    );
    expect(await service.list()).toEqual([]);
  });

  it('creates the sample document dated today', async () => {
    const summary = await service.createSample();

    expect(summary.name).toBe('Appointment booking');
    expect(summary.date).toBe(new Date().toISOString().slice(0, 10));
    const listed = await service.list();
    expect(listed.map((d) => d.id)).toEqual([summary.id]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(await service.findById('missing')).toBe(null);
  });
});
