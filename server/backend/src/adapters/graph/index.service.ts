import type { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import type { SystemModelStore } from '#backend/adapters/store/system-model.store';
import type {
  DecisionsStore,
  TopicsStore,
} from '#backend/adapters/store/wiki.store';
import type {
  DatabaseService,
  Transaction,
} from '#backend/platform/database/database.service';
import { NoesisStoreError } from '#backend/platform/files/noesis-store';
import { serverLogger } from '#backend/platform/logging/logging';
import { nodeTableNames } from './graph-schema';

const log = serverLogger('indexer');

export interface IndexReport {
  /** Knowledge graph files decoded into the graph. */
  files: number;
  durationMs: number;
}

export interface IndexerSources {
  /** The changes and, through their child collections, what they own. */
  changes: NoesisChangesRepository;
  topics: TopicsStore;
  decisions: DecisionsStore;
  systemModels: SystemModelStore;
}

/** Rows per `UNWIND` statement; one statement per file would be 5× slower. */
const BATCH_SIZE = 1000;

type Row = Record<string, string>;

/**
 * Builds the graph from the files in `.noesis/graph/`. Every rebuild is a
 * full one: the tables are emptied and reloaded from what the stores read,
 * so the graph after a rebuild is a function of the files alone — whatever
 * changed them, including a `git checkout` while the process runs. The cost
 * is measured (`test/bench`) and stays within budget without an incremental
 * path (decision D2).
 */
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

    // One transaction: readers see the old graph until the commit, never a
    // half-rebuilt one (decision D3).
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
    for await (const topic of objects(topics)) {
      push('Topic', {
        id: topic.id,
        parent_id: topic.parent_id ?? '',
        title: topic.title,
        short_summary: topic.short_summary,
        json: JSON.stringify(topic),
      });
    }
    for await (const model of objects(systemModels)) {
      push('SystemModel', {
        id: model.id,
        name: model.name,
        scanned_at: model.scanned_at,
        json: JSON.stringify(model),
      });
    }
    for await (const decision of objects(decisions)) {
      push('Decision', {
        id: decision.id,
        topic_id: decision.topic_id,
        title: decision.title,
        status: decision.status,
        json: JSON.stringify(decision),
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
  // Every row of a table has the same keys; the first row names them.
  const columns = Object.keys(rows[0] ?? {});
  const assignments = columns.map((c) => `${c}: r.${c}`).join(', ');
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await tx.query(`UNWIND $rows AS r CREATE (:${table} { ${assignments} })`, {
      rows: rows.slice(i, i + BATCH_SIZE),
    });
  }
}

/** What the walk needs of a store handle: keys, and one object per key. */
interface Readable<T> {
  keys(): AsyncIterable<string>;
  get(key: string): Promise<T | null>;
}

/**
 * The objects of one collection, `keys()` then `get` per key (decision D2).
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
