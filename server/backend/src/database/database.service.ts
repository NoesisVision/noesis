import lbug, { type LbugValue } from '@ladybugdb/core';

const { Database, Connection } = lbug;

type LbugDatabase = InstanceType<typeof Database>;
type LbugConnection = InstanceType<typeof Connection>;
export type QueryParams = Record<string, LbugValue>;

// Owns the LadybugDB database handle. The database is in-memory only: the
// graph is a cache over the files in `.noesis/`, rebuilt by the indexer at
// boot and on every change, so nothing of it touches the disk and there is
// nothing to recover (decision 68). Constructed and initialized by the
// composition root (main.ts), which also closes it on shutdown so native
// resources are released deterministically (decisions 23/35).
export class DatabaseService {
  private database: LbugDatabase | null = null;
  private connection: LbugConnection | null = null;

  init(): void {
    this.database = new Database(':memory:');
    this.connection = new Connection(this.database);
    console.log('[DatabaseService] LadybugDB initialized (in-memory)');
  }

  async close(): Promise<void> {
    if (this.connection !== null) {
      await this.connection.close();
      this.connection = null;
    }
    if (this.database !== null) {
      await this.database.close();
      this.database = null;
    }
  }

  getConnection(): LbugConnection {
    if (this.connection === null) {
      throw new Error('Database not initialized.');
    }
    return this.connection;
  }

  async query<Row = unknown>(
    cypher: string,
    params?: QueryParams,
  ): Promise<Row[]> {
    const conn = this.getConnection();
    const result =
      params === undefined
        ? await conn.query(cypher)
        : await conn.execute(await conn.prepare(cypher), params);
    try {
      return extractRows<Row>(result);
    } finally {
      // QueryResults hold native handles; close them here so they are freed
      // deterministically instead of at the GC's whim. (On lbug 0.14.3 a
      // result finalized after its Database closed segfaulted — decision 23;
      // not reproducible on @ladybugdb/core 0.18.0, kept as hygiene.)
      closeResults(result);
    }
  }
}

function extractRows<Row>(result: unknown): Row[] {
  const source: unknown = Array.isArray(result) ? result[0] : result;
  return (source as { getAllSync(): unknown[] }).getAllSync() as Row[];
}

function closeResults(result: unknown): void {
  for (const r of Array.isArray(result) ? result : [result]) {
    (r as { close(): void }).close();
  }
}
