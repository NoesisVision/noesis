import type { SystemModelStore } from '#backend/adapters/store/system-model.store';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import type {
  DatabaseService,
  Transaction,
} from '#backend/platform/database/database.service';
import { JsonFileError } from '#backend/platform/files/json-file';
import { serverLogger } from '#backend/platform/logging/logging';
import { nodeTableNames } from './graph-schema';

const log = serverLogger('indexer');

export interface IndexReport {
  files: number;
  durationMs: number;
}

export interface IndexerSources {
  changes: ChangesRepository;
  designDocs: DesignDocsRepository;
  documents: DocumentsRepository;
  systemModels: SystemModelStore;
}

/** Rows per `UNWIND`; one statement per file is 5× slower. */
const BATCH_SIZE = 1000;

type Row = Record<string, string | boolean>;

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
    const { changes, designDocs, documents, systemModels } = this.sources;
    const rows = new Map<string, Row[]>([
      ['DesignDoc', []],
      ['Document', []],
      ['SystemModel', []],
    ]);
    const push = (table: string, row: Row) => rows.get(table)?.push(row);

    for (const { id: change } of await objects(() => changes.list())) {
      for (const document of await objects(() => designDocs.list(change))) {
        push('DesignDoc', {
          key: `${change}/${document.id}`,
          id: document.id,
          change,
          name: document.name.value,
          implemented: document.implemented,
          // Element ids serialise as the strings they decode from.
          document: JSON.stringify(document),
        });
      }
      for (const document of await objects(() => documents.list(change))) {
        push('Document', {
          key: `${change}/${document.id}`,
          id: document.id,
          change,
          title: document.title,
          date: document.date,
          json: JSON.stringify(document),
        });
      }
    }
    for (const model of await objects(() => systemModels.list())) {
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

/**
 * A broken file costs its list, not the rebuild: `list()` has no per-file
 * grain, so a broken document hides that change's documents.
 */
async function objects<T>(list: () => Promise<T[]>): Promise<T[]> {
  try {
    return await list();
  } catch (error) {
    if (!(error instanceof JsonFileError)) throw error;
    log.warn('skipping {path}: {error}', {
      path: error.path,
      error: error.message,
    });
    return [];
  }
}
