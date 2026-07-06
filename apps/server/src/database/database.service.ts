import { mkdirSync } from 'node:fs';
import lbug, { type LbugValue } from 'lbug';

const { Database, Connection } = lbug;

type LbugDatabase = InstanceType<typeof Database>;
type LbugConnection = InstanceType<typeof Connection>;
export type QueryParams = Record<string, LbugValue>;

// Owns the lbug database handle. Constructed and initialized by the
// composition root (main.ts), which also closes it on shutdown — lbug handles
// left to GC finalizers segfault after their Database closes (decision 23).
export class DatabaseService {
  private readonly dataDir: string;
  private database: LbugDatabase | null = null;
  private connection: LbugConnection | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  init(): void {
    let dbPath: string;
    if (this.dataDir === ':memory:') {
      // Ephemeral in-memory DB (used by tests).
      dbPath = ':memory:';
    } else {
      // On-disk (production default): lbug opens the DB inside dataDir but does
      // not create dataDir itself, so ensure it exists first.
      mkdirSync(this.dataDir, { recursive: true });
      dbPath = `${this.dataDir}/ladybug-db`;
    }
    this.database = new Database(dbPath);
    this.connection = new Connection(this.database);
    console.log('[DatabaseService] LadybugDB initialized');
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
      // QueryResults hold native handles. One left to the GC and finalized
      // after its Database was closed segfaults the process (use-after-free
      // in lbug's native finalizer), so always close them explicitly here.
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
