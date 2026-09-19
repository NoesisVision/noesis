import type lbug from '@ladybugdb/core';
import type { LbugValue } from '@ladybugdb/core';
import { serverLogger } from '#backend/platform/logging/logging';

type LbugDatabase = InstanceType<typeof lbug.Database>;
type LbugConnection = InstanceType<typeof lbug.Connection>;
type LbugPreparedStatement = InstanceType<typeof lbug.PreparedStatement>;
type LbugQueryResult = InstanceType<typeof lbug.QueryResult>;
export type QueryParams = Record<string, LbugValue>;

/** What a `transaction()` callback may do: run statements inside it. */
export interface Transaction {
  query<Row = unknown>(cypher: string, params?: QueryParams): Promise<Row[]>;
}

const log = serverLogger('db');

export class DatabaseService {
  private database: LbugDatabase | null = null;
  private reader: Session | null = null;
  private writer: Session | null = null;
  private closing = false;
  /** Work `close()` must wait for: every running `query()` and `transaction()`. */
  private readonly inFlight = new Set<Promise<unknown>>();
  /** Serialises `transaction()` callers: one write transaction at a time. */
  private writeQueue: Promise<unknown> = Promise.resolve();

  async init(): Promise<void> {
    if (this.database !== null) {
      throw new Error('Database already initialized.');
    }
    const { Database, Connection } = (await import('@ladybugdb/core')).default;
    const database = new Database(':memory:');
    const reader = new Connection(database);
    const writer = new Connection(database);
    // Eager, so a broken native binary fails here at the composition root
    // rather than inside the first query.
    await database.init();
    await reader.init();
    await writer.init();
    this.database = database;
    this.reader = new Session(reader);
    this.writer = new Session(writer);
    this.closing = false;
    log.info('LadybugDB initialized (in-memory)');
  }

  async close(): Promise<void> {
    if (this.database === null) return;
    this.closing = true;
    // Let running statements finish; a native handle closed under a query
    // is what decision D3's shutdown ordering exists to avoid.
    await Promise.allSettled([...this.inFlight, this.writeQueue]);
    const { database, reader, writer } = this;
    this.database = null;
    this.reader = null;
    this.writer = null;
    await writer?.close();
    await reader?.close();
    await database.close();
  }

  /** Runs one statement outside any transaction (auto-commit), for reads. */
  async query<Row = unknown>(
    cypher: string,
    params?: QueryParams,
  ): Promise<Row[]> {
    const reader = this.open(this.reader);
    return this.track(reader.run<Row>(cypher, params));
  }

  /**
   * Runs `fn` inside one write transaction on the writer connection:
   * `BEGIN TRANSACTION`, the callback's statements, `COMMIT`; `ROLLBACK`
   * when it throws. Callers queue up, so two transactions never overlap.
   */
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const writer = this.open(this.writer);
    const run = this.writeQueue.then(() => runTransaction(writer, fn));
    this.writeQueue = run.catch(() => undefined);
    return this.track(run);
  }

  private open(session: Session | null): Session {
    if (session === null || this.closing) {
      throw new Error('Database not initialized.');
    }
    return session;
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.inFlight.add(work);
    return work.finally(() => this.inFlight.delete(work));
  }
}

async function runTransaction<T>(
  writer: Session,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  await writer.run('BEGIN TRANSACTION');
  let value: T;
  try {
    value = await fn({ query: (cypher, params) => writer.run(cypher, params) });
  } catch (error) {
    // The callback's error is the one worth reporting; a failing rollback
    // would only hide it.
    await writer.run('ROLLBACK').catch(() => undefined);
    throw error;
  }
  await writer.run('COMMIT');
  return value;
}

// One connection plus its prepared statements. A statement is prepared once
// per Cypher text and executed many times; the cache lives as long as the
// connection, and the schema does not change after boot, so a plan never
// goes stale.
class Session {
  private readonly connection: LbugConnection;
  private readonly prepared = new Map<string, Promise<LbugPreparedStatement>>();

  constructor(connection: LbugConnection) {
    this.connection = connection;
  }

  async run<Row>(cypher: string, params?: QueryParams): Promise<Row[]> {
    const result =
      params === undefined
        ? await this.connection.query(cypher)
        : await this.connection.execute(await this.prepare(cypher), params);
    try {
      return extractRows<Row>(result);
    } finally {
      // QueryResults hold native handles; close them here so they are freed
      // deterministically instead of at the GC's whim.
      closeResults(result);
    }
  }

  async close(): Promise<void> {
    this.prepared.clear();
    await this.connection.close();
  }

  private prepare(cypher: string): Promise<LbugPreparedStatement> {
    let statement = this.prepared.get(cypher);
    if (statement === undefined) {
      statement = this.connection.prepare(cypher).then((prepared) => {
        // A statement that failed to prepare (bad Cypher) is not worth
        // keeping; `execute` will reject with its message.
        if (!prepared.isSuccess()) this.prepared.delete(cypher);
        return prepared;
      });
      statement.catch(() => this.prepared.delete(cypher));
      this.prepared.set(cypher, statement);
    }
    return statement;
  }
}

/**
 * The rows of a result. `query()` and `execute()` return one result per
 * statement; the service runs one statement per call, and the last
 * statement's rows are the answer in the odd case of several.
 */
function extractRows<Row>(result: LbugQueryResult | LbugQueryResult[]): Row[] {
  const last = Array.isArray(result) ? result[result.length - 1] : result;
  if (last === undefined) return [];
  return last.getAllSync() as Row[];
}

function closeResults(result: LbugQueryResult | LbugQueryResult[]): void {
  for (const r of Array.isArray(result) ? result : [result]) r.close();
}
