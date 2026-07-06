import type { DatabaseService } from '../database/database.service.js';
import { GRAPH_SCHEMA } from './graph-schema.js';

export class SchemaService {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // Called once from the composition root at startup, after DatabaseService
  // has connected. Idempotent — safe on every boot.
  async ensureSchema(): Promise<void> {
    for (const ddl of GRAPH_SCHEMA) {
      await this.db.query(ddl);
    }
    console.log(
      `[SchemaService] Graph schema ensured (${GRAPH_SCHEMA.length} tables)`,
    );
  }

  // The declared schema, for the schema-explorer (migrated in a later part).
  statements(): readonly string[] {
    return GRAPH_SCHEMA;
  }
}
