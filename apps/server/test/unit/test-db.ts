import { DatabaseService } from '../../src/database/database.service.js';
import { GRAPH_SCHEMA } from '../../src/schema/graph-schema.js';
import { SchemaService } from '../../src/schema/schema.service.js';

// Why this exists: the bundled `lbug` build segfaults once more than a handful
// of `Database` instances are opened in a single OS process (a kuzu global-state
// limitation), and `bun test` loads every `*.spec.ts` into ONE process. So
// every DB-touching spec must share ONE database instead of standing up its own.
//
// This fixture lazily creates a single in-memory database with the full graph
// schema, reused across all specs in the process. Tests isolate themselves by
// calling `resetGraph()` (deletes all data, keeps the schema). The
// DatabaseService lifecycle spec is the one deliberate exception — it manages
// its own instances to test init/destroy, and is kept to the minimum count.

let shared: DatabaseService | undefined;

export async function sharedTestDatabase(): Promise<DatabaseService> {
  if (shared === undefined) {
    const db = new DatabaseService(':memory:');
    db.init();
    await new SchemaService(db).ensureSchema();
    shared = db;
  }
  return shared;
}

// Removes all rows from every declared node table, leaving the schema intact.
// Call from `afterEach` so specs don't see each other's data.
export async function resetGraph(): Promise<void> {
  if (shared === undefined) return;
  for (const table of nodeTableNames()) {
    await shared.query(`MATCH (n:${table}) DETACH DELETE n`);
  }
}

// Parses the node-table names out of the central DDL so this fixture stays in
// sync with the schema as later parts add tables.
function nodeTableNames(): string[] {
  const names: string[] = [];
  for (const ddl of GRAPH_SCHEMA) {
    const match = /CREATE NODE TABLE IF NOT EXISTS\s+(\w+)/i.exec(ddl);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}
