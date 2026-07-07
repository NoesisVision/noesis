import { describe, expect, it } from 'bun:test';
import { DatabaseService } from '../../src/database/database.service.js';

// This spec deliberately stands up its own DatabaseService instances to
// exercise the init/destroy lifecycle — it cannot use the shared fixture
// (see test-db.ts).
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
    service.init();

    // Set up via service.query — the convention is that all lbug access goes
    // through it so QueryResults are closed deterministically (see query()).
    await service.query(
      'CREATE NODE TABLE IF NOT EXISTS Thing(id STRING, label STRING, PRIMARY KEY(id))',
    );
    await service.query("CREATE (t:Thing {id: 'b', label: 'beta'})");

    // Parameterized query (prepare + execute) returns typed rows.
    const rows = await service.query<{ label: string }>(
      'MATCH (t:Thing) WHERE t.id = $id RETURN t.label AS label',
      { id: 'b' },
    );
    expect(rows).toEqual([{ label: 'beta' }]);

    // Destroy releases the connection; re-init yields a fresh working one.
    await service.close();
    expect(() => service.getConnection()).toThrow('Database not initialized');

    service.init();
    const after = await service.query<{ x: number | bigint }>('RETURN 2 AS x');
    expect(after.map((r) => Number(r.x))).toEqual([2]);
    await service.close();
  });
});
