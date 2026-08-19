import { mkdirSync } from 'node:fs';
import lbug, { type LbugValue } from '@ladybugdb/core';

const { Database, Connection } = lbug;

type LbugDatabase = InstanceType<typeof Database>;
type LbugConnection = InstanceType<typeof Connection>;
export type QueryParams = Record<string, LbugValue>;

// Owns the LadybugDB database handle. Constructed and initialized by the
// composition root (main.ts), which also closes it on shutdown so native
// resources are released deterministically (decisions 23/35).
export class DatabaseService {
  private readonly dataDir: string;
  /** `:memory:` for the ephemeral database, otherwise the on-disk file. */
  private readonly dbPath: string;
  private database: LbugDatabase | null = null;
  private connection: LbugConnection | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.dbPath = dataDir === ':memory:' ? ':memory:' : `${dataDir}/ladybug-db`;
  }

  /**
   * Where lbug keeps the write-ahead log, or null for the in-memory database.
   * Exposed because a torn log is recoverable only by deleting this file, and
   * the composition root is the one that decides to (decision 62).
   */
  get walPath(): string | null {
    return this.dbPath === ':memory:' ? null : `${this.dbPath}.wal`;
  }

  init(): void {
    if (this.dbPath !== ':memory:') {
      // lbug opens the database inside dataDir but does not create dataDir
      // itself, so ensure it exists first.
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.database = new Database(this.dbPath);
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
