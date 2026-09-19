import { nodeTableNames } from '#backend/adapters/graph/graph-schema';
import { SchemaService } from '#backend/adapters/graph/schema.service';
import { DatabaseService } from '#backend/platform/database/database.service';

// `bun test` loads every `*.spec.ts` into ONE process, so one database keeps
// schema setup out of every spec. The DatabaseService lifecycle spec is the
// deliberate exception: it manages its own instances to test init/close.

let shared: DatabaseService | undefined;

export async function sharedTestDatabase(): Promise<DatabaseService> {
  if (shared === undefined) {
    const db = new DatabaseService();
    await db.init();
    await new SchemaService(db).ensureSchema();
    shared = db;
  }
  return shared;
}

// Call from `afterEach` so specs don't see each other's data.
export async function resetGraph(): Promise<void> {
  if (shared === undefined) return;
  await shared.transaction(async (tx) => {
    for (const table of nodeTableNames()) {
      await tx.query(`MATCH (n:${table}) DETACH DELETE n`);
    }
  });
}
