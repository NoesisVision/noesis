import type { ChangesRepository } from '../changes/changes.repository.js';
import type { DatabaseService } from '../database/database.service.js';
import { NoesisStoreError } from '../files/noesis-store.js';
import { serverLogger } from '../logging/logging.js';
import { nodeTableNames } from '../schema/graph-schema.js';
import type { SystemModelRepository } from '../system-model/system-model.repository.js';
import type {
  DecisionsRepository,
  TopicsRepository,
} from '../wiki/wiki.repository.js';

const log = serverLogger('indexer');

export interface IndexReport {
  /** Knowledge graph files decoded into the graph. */
  files: number;
  durationMs: number;
}

export interface IndexerSources {
  /** The changes and, through their child collections, what they own. */
  changes: ChangesRepository;
  topics: TopicsRepository;
  decisions: DecisionsRepository;
  systemModels: SystemModelRepository;
}

/** Rows per `UNWIND` statement; one statement per file would be 5× slower. */
const BATCH_SIZE = 1000;

type Row = Record<string, string>;

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
  private readonly sources: IndexerSources;

  constructor(db: DatabaseService, sources: IndexerSources) {
    this.db = db;
    this.sources = sources;
  }

  async rebuild(): Promise<IndexReport> {
    const started = performance.now();
    const rows = await this.collect();

    for (const table of nodeTableNames()) {
      await this.db.query(`MATCH (n:${table}) DETACH DELETE n`);
    }
    let files = 0;
    for (const [table, tableRows] of rows) {
      files += tableRows.length;
      await this.insert(table, tableRows);
    }

    const report = {
      files,
      durationMs: Math.round(performance.now() - started),
    };
    log.info('indexed {files} files in {durationMs} ms', report);
    return report;
  }

  private async collect(): Promise<Map<string, Row[]>> {
    const { changes, topics, decisions, systemModels } = this.sources;
    const rows = new Map<string, Row[]>([
      ['DesignDoc', []],
      ['Conversation', []],
      ['Document', []],
      ['Topic', []],
      ['Decision', []],
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
      for await (const conversation of objects(owned.conversations)) {
        push('Conversation', {
          id: conversation.conversation_id,
          change,
          title: conversation.main_topic,
          time: conversation.time,
          json: JSON.stringify(conversation),
        });
      }
      for await (const document of objects(owned.documents)) {
        push('Document', {
          id: document.document_id,
          change,
          title: document.title,
          date: document.date,
          json: JSON.stringify(document),
        });
      }
    }
    for (const s of await topics.list()) {
      push('Topic', {
        id: s.entity.id,
        parent_id: s.entity.parent_id ?? '',
        title: s.entity.title,
        short_summary: s.entity.short_summary,
        json: JSON.stringify(s.entity),
      });
    }
    for (const s of await systemModels.list()) {
      push('SystemModel', {
        id: s.entity.id,
        name: s.entity.name,
        scanned_at: s.entity.scanned_at,
        json: JSON.stringify(s.entity),
      });
    }
    for (const s of await decisions.list()) {
      push('Decision', {
        id: s.entity.id,
        topic_id: s.entity.topic_id,
        title: s.entity.title,
        status: s.entity.status,
        json: JSON.stringify(s.entity),
      });
    }
    return rows;
  }

  private async insert(table: string, rows: Row[]): Promise<void> {
    if (rows.length === 0) return;
    // Every row of a table has the same keys; the first row names them.
    const columns = Object.keys(rows[0] ?? {});
    const assignments = columns.map((c) => `${c}: r.${c}`).join(', ');
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await this.db.query(
        `UNWIND $rows AS r CREATE (:${table} { ${assignments} })`,
        { rows: rows.slice(i, i + BATCH_SIZE) },
      );
    }
  }
}

/** What the walk needs of a store handle: keys, and one object per key. */
interface Readable<T> {
  keys(): AsyncIterable<string>;
  get(key: string): Promise<T | null>;
}

/**
 * The objects of one collection, `keys()` then `get` per key (decision 76).
 * A corrupt or invalid file costs that one key, logged, not the walk; an
 * object that vanishes between the two is not an object; and a change taken
 * away under the walk — a `git checkout` — ends it with what it had.
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
