import { beforeAll, describe, expect, it } from 'bun:test';
import { GRAPH_SCHEMA } from '#backend/adapters/graph/graph-schema';
import { SchemaService } from '#backend/adapters/graph/schema.service';
import type { DatabaseService } from '#backend/platform/database/database.service';
import { sharedTestDatabase } from './test-db';

describe('SchemaService', () => {
  let db: DatabaseService;
  let schema: SchemaService;

  beforeAll(async () => {
    db = await sharedTestDatabase();
    schema = new SchemaService(db);
  });

  it('has created the declared tables (a MATCH would error otherwise)', async () => {
    const rows = await db.query<{ n: number | bigint }>(
      'MATCH (d:DesignDoc) RETURN count(d) AS n',
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
      'MATCH (d:DesignDoc) RETURN count(d) AS n',
    );
    expect(rows.length).toBe(1);
  });
});
