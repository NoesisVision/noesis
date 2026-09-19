import type { DatabaseService } from '#backend/platform/database/database.service';
import { serverLogger } from '#backend/platform/logging/logging';
import { GRAPH_SCHEMA } from './graph-schema';

const log = serverLogger('schema');

export class SchemaService {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // DDL is transactional in LadybugDB, so the schema lands whole or not at all.
  async ensureSchema(): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const ddl of GRAPH_SCHEMA) {
        await tx.query(ddl);
      }
    });
    log.info('graph schema ensured ({statements} statements)', {
      statements: GRAPH_SCHEMA.length,
    });
  }

  // For the schema-explorer, not yet migrated.
  statements(): readonly string[] {
    return GRAPH_SCHEMA;
  }
}
