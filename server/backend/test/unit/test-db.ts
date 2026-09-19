import { nodeTableNames } from '#backend/adapters/graph/graph-schema';
import { SchemaService } from '#backend/adapters/graph/schema.service';
import { DatabaseService } from '#backend/platform/database/database.service';

// Why this exists: `bun test` loads every `*.spec.ts` into ONE process, and a
// shared database keeps schema setup out of every spec. (Original motivation
// was stronger: lbug 0.14.3 segfaulted once more than a handful of `Database`
// instances were opened per process. That no longer reproduces on
// @ladybugdb/core 0.18.0 — archived decision 35 — but the shared fixture
// stays for speed.)
//
// This fixture lazily creates a single in-memory database with the full graph
// schema, reused across all specs in the process. Tests isolate themselves by
// calling `resetGraph()` (deletes all data, keeps the schema). The
// DatabaseService lifecycle spec is the one deliberate exception — it manages
// its own instances to test init/destroy.

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

// Removes all rows from every declared node table, leaving the schema intact.
// Call from `afterEach` so specs don't see each other's data.
export async function resetGraph(): Promise<void> {
  if (shared === undefined) return;
  await shared.transaction(async (tx) => {
    for (const table of nodeTableNames()) {
      await tx.query(`MATCH (n:${table}) DETACH DELETE n`);
    }
  });
}
