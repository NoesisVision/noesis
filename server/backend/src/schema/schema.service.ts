import type { DatabaseService } from '../database/database.service.js';
import { serverLogger } from '../logging/logging.js';
import { GRAPH_SCHEMA } from './graph-schema.js';

const log = serverLogger('schema');

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
    log.info('graph schema ensured ({statements} statements)', {
      statements: GRAPH_SCHEMA.length,
    });
  }

  // The declared schema, for the schema-explorer (migrated in a later part).
  statements(): readonly string[] {
    return GRAPH_SCHEMA;
  }
}
