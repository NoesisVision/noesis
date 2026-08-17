import type { DesignDocument } from '@repo/shared-contracts';
import type { DatabaseService } from '../database/database.service.js';

// Internal row shape. `document` is the serialized `DesignDocument`; the
// summary row leaves it out so listing never deserializes every document.
export interface DesignDocRow {
  id: string;
  project_id: string;
  name: string;
  status: string;
  date: string;
  document: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type DesignDocSummaryRow = Omit<DesignDocRow, 'document'>;

// lbug returns INT64 columns as `bigint`; normalize at the repository edge.
interface RawSummaryRow extends Omit<DesignDocSummaryRow, 'version'> {
  version: number | bigint;
}

interface RawDesignDocRow extends RawSummaryRow {
  document: string;
}

const RETURN_SUMMARY = `RETURN d.id AS id, d.project_id AS project_id, d.name AS name,
         d.status AS status, d.date AS date, d.version AS version,
         d.created_at AS created_at, d.updated_at AS updated_at`;

const RETURN_DOC = `${RETURN_SUMMARY}, d.document AS document`;

/**
 * Graph reads and writes behind design documents. The document arrives here
 * already validated (schema parse + integrity check in the service); this
 * layer only guards the graph-side invariant — a design document hangs off an
 * existing project — as a conditional write, never read-then-write.
 */
export class DesignDocsRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Creates the node and its `HasDesignDoc` edge only while the project
   * exists. `null` back means the project does not — the service turns that
   * into the explainable error the routes owe the UI.
   */
  async create(
    projectId: string,
    document: DesignDocument,
  ): Promise<DesignDocRow | null> {
    const now = new Date().toISOString();
    const rows = await this.db.query<RawDesignDocRow>(
      `MATCH (p:Project {id: $projectId})
       CREATE (d:DesignDoc {
         id: $id, project_id: $projectId, name: $name, status: $status,
         date: $date, document: $document, version: 0,
         created_at: $now, updated_at: $now
       })
       CREATE (p)-[:HasDesignDoc]->(d)
       ${RETURN_DOC}`,
      {
        projectId,
        id: document.id,
        name: document.name,
        status: document.status,
        date: document.date,
        document: JSON.stringify(document),
        now,
      },
    );
    const row = rows[0];
    return row ? toDocRow(row) : null;
  }

  async findById(id: string): Promise<DesignDocRow | null> {
    const rows = await this.db.query<RawDesignDocRow>(
      `MATCH (d:DesignDoc {id: $id}) ${RETURN_DOC}`,
      { id },
    );
    const row = rows[0];
    return row ? toDocRow(row) : null;
  }

  /** Newest first — `date` drives ordering on the documents page (design-doc.ts). */
  async listByProject(projectId: string): Promise<DesignDocSummaryRow[]> {
    const rows = await this.db.query<RawSummaryRow>(
      `MATCH (:Project {id: $projectId})-[:HasDesignDoc]->(d:DesignDoc)
       ${RETURN_SUMMARY}
       ORDER BY d.date DESC, d.name`,
      { projectId },
    );
    return rows.map(toSummaryRow);
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `MATCH (d:DesignDoc {id: $id})
       WITH d, d.id AS id
       DETACH DELETE d
       RETURN id`,
      { id },
    );
    return rows.length > 0;
  }
}

function toSummaryRow(raw: RawSummaryRow): DesignDocSummaryRow {
  return {
    id: raw.id,
    project_id: raw.project_id,
    name: raw.name,
    status: raw.status,
    date: raw.date,
    version: Number(raw.version),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function toDocRow(raw: RawDesignDocRow): DesignDocRow {
  return { ...toSummaryRow(raw), document: raw.document };
}
