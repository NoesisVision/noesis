import { describe, expect, it } from 'bun:test';
import { DatabaseService } from '#backend/platform/database/database.service';

// This spec deliberately stands up its own DatabaseService instances to
// exercise the init/close lifecycle — it cannot use the shared fixture
// (see test-db.ts).
function newService(): DatabaseService {
  return new DatabaseService();
}

const THING_TABLE =
  'CREATE NODE TABLE IF NOT EXISTS Thing(id STRING, label STRING, PRIMARY KEY(id))';

async function count(service: DatabaseService): Promise<number> {
  const rows = await service.query<{ n: number | bigint }>(
    'MATCH (t:Thing) RETURN count(*) AS n',
  );
  return Number(rows[0]?.n);
}

describe('DatabaseService', () => {
  it('rejects queries before initialization and after close', async () => {
    const service = newService();
    expect(service.query('RETURN 1')).rejects.toThrow(
      'Database not initialized',
    );
    expect(service.transaction(async () => undefined)).rejects.toThrow(
      'Database not initialized',
    );
    await service.init();
    await service.close();
    expect(service.query('RETURN 1')).rejects.toThrow(
      'Database not initialized',
    );
  });

  it('refuses a second init without a close in between', async () => {
    const service = newService();
    await service.init();
    try {
      expect(service.init()).rejects.toThrow('Database already initialized');
    } finally {
      await service.close();
    }
  });

  it('connects, runs parameterized queries, and re-initializes after close', async () => {
    const service = newService();
    await service.init();

    // Writes go through a transaction (decision D3); reads through query().
    await service.transaction(async (tx) => {
      await tx.query(THING_TABLE);
      await tx.query("CREATE (t:Thing {id: 'b', label: 'beta'})");
    });

    // Parameterized query (prepare + execute) returns typed rows, and the
    // prepared statement is reused across calls with different parameters.
    const cypher = 'MATCH (t:Thing) WHERE t.id = $id RETURN t.label AS label';
    expect(await service.query(cypher, { id: 'b' })).toEqual([
      { label: 'beta' },
    ]);
    expect(await service.query(cypher, { id: 'nope' })).toEqual([]);
    expect(await service.query(cypher, { id: 'b' })).toEqual([
      { label: 'beta' },
    ]);

    // Close releases the connections; re-init yields a fresh working one.
    await service.close();
    await service.init();
    const after = await service.query<{ x: number | bigint }>('RETURN 2 AS x');
    expect(after.map((r) => Number(r.x))).toEqual([2]);
    await service.close();
  });

  it('commits a transaction as a whole and rolls back on throw', async () => {
    const service = newService();
    await service.init();
    try {
      await service.transaction((tx) => tx.query(THING_TABLE));

      const failed = service.transaction(async (tx) => {
        await tx.query("CREATE (t:Thing {id: 'x', label: 'x'})");
        throw new Error('boom');
      });
      expect(failed).rejects.toThrow('boom');
      await failed.catch(() => undefined);
      expect(await count(service)).toBe(0);

      await service.transaction(async (tx) => {
        await tx.query("CREATE (t:Thing {id: 'y', label: 'y'})");
        await tx.query("CREATE (t:Thing {id: 'z', label: 'z'})");
      });
      expect(await count(service)).toBe(2);
    } finally {
      await service.close();
    }
  });

  it('keeps readers on the committed snapshot while a transaction runs', async () => {
    const service = newService();
    await service.init();
    try {
      await service.transaction((tx) => tx.query(THING_TABLE));

      let seenInside = -1;
      await service.transaction(async (tx) => {
        await tx.query("CREATE (t:Thing {id: 'a', label: 'a'})");
        // The reader connection is outside the transaction: nothing yet.
        seenInside = await count(service);
      });
      expect(seenInside).toBe(0);
      expect(await count(service)).toBe(1);
    } finally {
      await service.close();
    }
  });

  it('serializes overlapping transactions', async () => {
    const service = newService();
    await service.init();
    try {
      await service.transaction((tx) => tx.query(THING_TABLE));
      const order: string[] = [];
      await Promise.all([
        service.transaction(async (tx) => {
          order.push('first:begin');
          await tx.query("CREATE (t:Thing {id: '1', label: '1'})");
          order.push('first:end');
        }),
        service.transaction(async (tx) => {
          order.push('second:begin');
          await tx.query("CREATE (t:Thing {id: '2', label: '2'})");
          order.push('second:end');
        }),
      ]);
      expect(order).toEqual([
        'first:begin',
        'first:end',
        'second:begin',
        'second:end',
      ]);
      expect(await count(service)).toBe(2);
    } finally {
      await service.close();
    }
  });

  it('cuts off a runaway read', async () => {
    const service = newService();
    await service.init();
    try {
      // ~10^10 rows: far beyond the read timeout, well within the writer.
      const runaway = service.query(
        'UNWIND RANGE(1, 100000) AS x UNWIND RANGE(1, 100000) AS y RETURN count(x + y)',
      );
      expect(runaway).rejects.toThrow('Interrupted');
      await runaway.catch(() => undefined);
      // The connection is still usable afterwards.
      expect(await service.query('RETURN 1 AS x')).toHaveLength(1);
    } finally {
      await service.close();
    }
  }, 15_000);

  it('close waits for work in flight', async () => {
    const service = newService();
    await service.init();
    await service.transaction((tx) => tx.query(THING_TABLE));

    const write = service.transaction(async (tx) => {
      await tx.query("CREATE (t:Thing {id: 'w', label: 'w'})");
      return 'done';
    });
    const read = service.query<{ x: number | bigint }>('RETURN 1 AS x');
    await service.close();
    expect(await write).toBe('done');
    expect((await read).length).toBe(1);
  });
});
