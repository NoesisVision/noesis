import type { DesignDocument } from '@repo/shared-contracts';
import type { DatabaseService } from '../database/database.service.js';

// Internal row shape. `document` is the serialized `DesignDocument`; the
// summary row leaves it out so listing never deserializes every document.
export interface DesignDocRow {
  id: string;
  name: string;
  status: string;
  date: string;
  document: string;
  created_at: string;
  updated_at: string;
}

export type DesignDocSummaryRow = Omit<DesignDocRow, 'document'>;

const RETURN_SUMMARY = `RETURN d.id AS id, d.name AS name,
         d.status AS status, d.date AS date,
         d.created_at AS created_at, d.updated_at AS updated_at`;

const RETURN_DOC = `${RETURN_SUMMARY}, d.document AS document`;

/**
 * Graph reads and writes behind design documents. The document arrives here
 * already validated (schema parse + integrity check in the service); documents
 * are top-level, since the server serves the one checkout it was started in
 * (decision 65).
 */
export class DesignDocsRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  async create(document: DesignDocument): Promise<DesignDocRow> {
    const now = new Date().toISOString();
    const rows = await this.db.query<DesignDocRow>(
      `CREATE (d:DesignDoc {
         id: $id, name: $name, status: $status,
         date: $date, document: $document,
         created_at: $now, updated_at: $now
       })
       ${RETURN_DOC}`,
      {
        id: document.id,
        name: document.name,
        status: document.status,
        date: document.date,
        document: JSON.stringify(document),
        now,
      },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Design document creation returned no row.');
    }
    return row;
  }

  async findById(id: string): Promise<DesignDocRow | null> {
    const rows = await this.db.query<DesignDocRow>(
      `MATCH (d:DesignDoc {id: $id}) ${RETURN_DOC}`,
      { id },
    );
    return rows[0] ?? null;
  }

  /** Newest first — `date` drives ordering on the documents page (design-doc.ts). */
  async list(): Promise<DesignDocSummaryRow[]> {
    return this.db.query<DesignDocSummaryRow>(
      `MATCH (d:DesignDoc)
       ${RETURN_SUMMARY}
       ORDER BY d.date DESC, d.name`,
    );
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
