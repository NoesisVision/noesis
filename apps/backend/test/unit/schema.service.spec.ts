import { beforeAll, describe, expect, it } from 'bun:test';
import type { DatabaseService } from '../../src/database/database.service.js';
import { GRAPH_SCHEMA } from '../../src/schema/graph-schema.js';
import { SchemaService } from '../../src/schema/schema.service.js';
import { sharedTestDatabase } from './test-db.js';

describe('SchemaService', () => {
  let db: DatabaseService;
  let schema: SchemaService;

  beforeAll(async () => {
    db = await sharedTestDatabase();
    schema = new SchemaService(db);
  });

  it('has created the declared tables (a MATCH would error otherwise)', async () => {
    const rows = await db.query<{ n: number | bigint }>(
      'MATCH (p:Project) RETURN count(p) AS n',
    );
    expect(rows.map((r) => Number(r.n)).length).toBe(1);
  });

  it('exposes the declared schema for the schema-explorer', () => {
    expect(schema.statements()).toBe(GRAPH_SCHEMA);
    expect(GRAPH_SCHEMA.length).toBeGreaterThan(0);
  });

  it('is idempotent — ensureSchema can run again without error', async () => {
    await schema.ensureSchema();
    const rows = await db.query<{ n: number | bigint }>(
      'MATCH (p:Project) RETURN count(p) AS n',
    );
    expect(rows.length).toBe(1);
  });
});
