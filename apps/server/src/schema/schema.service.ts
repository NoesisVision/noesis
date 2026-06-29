import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { GRAPH_SCHEMA } from './graph-schema.js';

@Injectable()
export class SchemaService implements OnModuleInit {
  private readonly logger = new Logger(SchemaService.name);

  constructor(private readonly db: DatabaseService) {}

  // Runs once at startup, after DatabaseService has connected (Nest initializes
  // this provider's dependency first). Idempotent — safe on every boot.
  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  async ensureSchema(): Promise<void> {
    for (const ddl of GRAPH_SCHEMA) {
      await this.db.query(ddl);
    }
    this.logger.log(`Graph schema ensured (${GRAPH_SCHEMA.length} tables)`);
  }

  // The declared schema, for the schema-explorer (migrated in a later part).
  statements(): readonly string[] {
    return GRAPH_SCHEMA;
  }
}
