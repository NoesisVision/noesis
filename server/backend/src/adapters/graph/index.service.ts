import type { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import type { SystemModelStore } from '#backend/adapters/store/system-model.store';
import type {
  DatabaseService,
  Transaction,
} from '#backend/platform/database/database.service';
import { NoesisStoreError } from '#backend/platform/files/noesis-store';
import { serverLogger } from '#backend/platform/logging/logging';
import { nodeTableNames } from './graph-schema';

const log = serverLogger('indexer');

export interface IndexReport {
  files: number;
  durationMs: number;
}

export interface IndexerSources {
  changes: NoesisChangesRepository;
  systemModels: SystemModelStore;
}

/** Rows per `UNWIND`; one statement per file is 5× slower. */
const BATCH_SIZE = 1000;

type Row = Record<string, string>;

// Every rebuild is a full one, so the graph is a function of the files alone,
// even across a `git checkout`. Measured in `test/bench`: no incremental path
// needed.
export class IndexService {
  private readonly db: DatabaseService;
  private readonly sources: IndexerSources;

  constructor(db: DatabaseService, sources: IndexerSources) {
    this.db = db;
    this.sources = sources;
  }

  async rebuild(): Promise<IndexReport> {
    const started = performance.now();
    const rows = await this.collect();

    // Readers see the old graph until the commit, never a half-rebuilt one.
    let files = 0;
    await this.db.transaction(async (tx) => {
      for (const table of nodeTableNames()) {
        await tx.query(`MATCH (n:${table}) DETACH DELETE n`);
      }
      for (const [table, tableRows] of rows) {
        files += tableRows.length;
        await insert(tx, table, tableRows);
      }
    });

    const report = {
      files,
      durationMs: Math.round(performance.now() - started),
    };
    log.info('indexed {files} files in {durationMs} ms', report);
    return report;
  }

  private async collect(): Promise<Map<string, Row[]>> {
    const { changes, systemModels } = this.sources;
    const rows = new Map<string, Row[]>([
      ['DesignDoc', []],
      ['Document', []],
      ['SystemModel', []],
    ]);
    const push = (table: string, row: Row) => rows.get(table)?.push(row);

    for await (const slug of changes.keys()) {
      const change = slug.value;
      const owned = changes.children(slug);
      for await (const document of objects(owned['design-docs'])) {
        const { id, name, status, date } = document;
        push('DesignDoc', {
          id,
          change,
          name,
          status,
          date,
          document: JSON.stringify(document),
        });
      }
      for await (const document of objects(owned.documents)) {
        push('Document', {
          key: `${change}/${document.document_id.value}`,
          id: document.document_id.value,
          change,
          title: document.title,
          date: document.date,
          json: JSON.stringify(document),
        });
      }
    }
    for await (const model of objects(systemModels)) {
      push('SystemModel', {
        id: model.id,
        name: model.name,
        scanned_at: model.scanned_at,
        json: JSON.stringify(model),
      });
    }
    return rows;
  }
}

async function insert(
  tx: Transaction,
  table: string,
  rows: Row[],
): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0] ?? {});
  const assignments = columns.map((c) => `${c}: r.${c}`).join(', ');
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await tx.query(`UNWIND $rows AS r CREATE (:${table} { ${assignments} })`, {
      rows: rows.slice(i, i + BATCH_SIZE),
    });
  }
}

interface Readable<T> {
  keys(): AsyncIterable<string>;
  get(key: string): Promise<T | null>;
}

/**
 * A corrupt file costs that one key, not the walk; a change removed under the
 * walk (a `git checkout`) ends it with what it had.
 */
async function* objects<T>(collection: Readable<T>): AsyncIterable<T> {
  try {
    for await (const key of collection.keys()) {
      try {
        const object = await collection.get(key);
        if (object !== null) yield object;
      } catch (error) {
        if (!isUndecodable(error)) throw error;
        log.warn('skipping {path}: {error}', {
          path: error.path ?? key,
          error: error.message,
        });
      }
    }
  } catch (error) {
    if (!isParentMissing(error)) throw error;
  }
}

function isUndecodable(error: unknown): error is NoesisStoreError {
  return (
    error instanceof NoesisStoreError &&
    (error.code === 'INVALID_JSON' || error.code === 'VALIDATION_FAILED')
  );
}

function isParentMissing(error: unknown): boolean {
  return error instanceof NoesisStoreError && error.code === 'PARENT_NOT_FOUND';
}
