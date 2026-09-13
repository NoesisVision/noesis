import type { ChangesRepository } from '../changes/changes.repository.js';
import type { DatabaseService } from '../database/database.service.js';
import type { DesignDocsRepository } from '../design-docs/design-docs.repository.js';
import { serverLogger } from '../logging/logging.js';
import { nodeTableNames } from '../schema/graph-schema.js';
import type {
  ConversationsRepository,
  DocumentsRepository,
} from '../sources/sources.repository.js';
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
  changes: ChangesRepository;
  designDocs: DesignDocsRepository;
  conversations: ConversationsRepository;
  documents: DocumentsRepository;
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
    const {
      changes,
      designDocs,
      conversations,
      documents,
      topics,
      decisions,
      systemModels,
    } = this.sources;
    const rows = new Map<string, Row[]>([
      ['DesignDoc', []],
      ['Conversation', []],
      ['Document', []],
      ['Topic', []],
      ['Decision', []],
      ['SystemModel', []],
    ]);
    const push = (table: string, row: Row) => rows.get(table)?.push(row);

    for (const change of await changes.list()) {
      for (const s of await designDocs.list(change)) {
        const { id, name, status, date } = s.entity;
        push('DesignDoc', {
          id,
          change,
          name,
          status,
          date,
          document: JSON.stringify(s.entity),
          updated_at: s.updatedAt,
        });
      }
      for (const s of await conversations.list(change)) {
        push('Conversation', {
          id: s.entity.conversation_id,
          change,
          title: s.entity.main_topic,
          time: s.entity.time,
          json: JSON.stringify(s.entity),
          updated_at: s.updatedAt,
        });
      }
      for (const s of await documents.list(change)) {
        push('Document', {
          id: s.entity.document_id,
          change,
          title: s.entity.title,
          date: s.entity.date,
          json: JSON.stringify(s.entity),
          updated_at: s.updatedAt,
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
        updated_at: s.updatedAt,
      });
    }
    for (const s of await systemModels.list()) {
      push('SystemModel', {
        id: s.entity.id,
        name: s.entity.name,
        scanned_at: s.entity.scanned_at,
        json: JSON.stringify(s.entity),
        updated_at: s.updatedAt,
      });
    }
    for (const s of await decisions.list()) {
      push('Decision', {
        id: s.entity.id,
        topic_id: s.entity.topic_id,
        title: s.entity.title,
        status: s.entity.status,
        json: JSON.stringify(s.entity),
        updated_at: s.updatedAt,
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
