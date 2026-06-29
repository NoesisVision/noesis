import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';
import { DatabaseService } from './database.service';

// This spec deliberately stands up its own DatabaseService instances to exercise
// the init/destroy lifecycle — it cannot use the shared fixture. lbug segfaults
// with many instances per process (see testing/test-db.ts), so instance count
// here is kept to the minimum: one test creates none, one creates two.
function newService(): DatabaseService {
  return new DatabaseService(':memory:');
}

describe('DatabaseService', () => {
  it('throws from getConnection before initialization', () => {
    const service = newService();
    expect(() => service.getConnection()).toThrow('Database not initialized');
  });

  it('connects, runs parameterized queries, and re-initializes after destroy', async () => {
    const service = newService();
    service.onModuleInit();

    // Parameterized query (prepare + execute) returns typed rows.
    const conn = service.getConnection();
    await conn.query(
      'CREATE NODE TABLE IF NOT EXISTS Thing(id STRING, label STRING, PRIMARY KEY(id))',
    );
    await conn.query("CREATE (t:Thing {id: 'b', label: 'beta'})");
    const rows = await service.query<{ label: string }>(
      'MATCH (t:Thing) WHERE t.id = $id RETURN t.label AS label',
      { id: 'b' },
    );
    expect(rows).toEqual([{ label: 'beta' }]);

    // Destroy releases the connection; re-init yields a fresh working one.
    await service.onModuleDestroy();
    expect(() => service.getConnection()).toThrow('Database not initialized');

    service.onModuleInit();
    const after = await service.query<{ x: number | bigint }>('RETURN 2 AS x');
    expect(after.map((r) => Number(r.x))).toEqual([2]);
    await service.onModuleDestroy();
  });
});
