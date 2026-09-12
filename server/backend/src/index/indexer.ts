import type { ChangesRepository } from '../changes/changes.repository.js';
import type { DatabaseService } from '../database/database.service.js';
import type { DesignDocsRepository } from '../design-docs/design-docs.repository.js';
import { nodeTableNames } from '../schema/graph-schema.js';

export interface IndexReport {
  /** Knowledge graph files decoded into the graph. */
  files: number;
  durationMs: number;
}

/** Rows per `UNWIND` statement; one statement per file would be 5× slower. */
const BATCH_SIZE = 1000;

/**
 * Builds the graph from the files in `.noesis/`. Every rebuild is a full one:
 * the tables are emptied and reloaded from what the file repositories read,
 * so the graph after a rebuild is a function of the files alone — whatever
 * changed them, including a `git checkout` while the process runs. The cost
 * is measured (`test/bench`) and stays within budget without an incremental
 * path (decision 68, point 12).
 */
export class GraphIndexer {
  private readonly db: DatabaseService;
  private readonly changes: ChangesRepository;
  private readonly designDocs: DesignDocsRepository;

  constructor(
    db: DatabaseService,
    changes: ChangesRepository,
    designDocs: DesignDocsRepository,
  ) {
    this.db = db;
    this.changes = changes;
    this.designDocs = designDocs;
  }

  async rebuild(): Promise<IndexReport> {
    const started = performance.now();

    const designDocs: DesignDocRow[] = [];
    for (const change of await this.changes.list()) {
      for (const stored of await this.designDocs.list(change)) {
        const { id, name, status, date } = stored.entity;
        designDocs.push({
          id,
          change,
          name,
          status,
          date,
          document: JSON.stringify(stored.entity),
          updated_at: stored.updatedAt,
        });
      }
    }

    for (const table of nodeTableNames()) {
      await this.db.query(`MATCH (n:${table}) DETACH DELETE n`);
    }
    for (let i = 0; i < designDocs.length; i += BATCH_SIZE) {
      await this.db.query(
        `UNWIND $rows AS r
         CREATE (:DesignDoc {
           id: r.id, change: r.change, name: r.name, status: r.status,
           date: r.date, document: r.document, updated_at: r.updated_at
         })`,
        { rows: designDocs.slice(i, i + BATCH_SIZE) },
      );
    }

    const report = {
      files: designDocs.length,
      durationMs: Math.round(performance.now() - started),
    };
    console.error(
      `[indexer] indexed ${report.files} files in ${report.durationMs} ms`,
    );
    return report;
  }
}

type DesignDocRow = Record<string, string> & {
  id: string;
  change: string;
  name: string;
  status: string;
  date: string;
  document: string;
  updated_at: string;
};
