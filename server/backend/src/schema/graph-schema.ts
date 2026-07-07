// Central declarative graph schema (OQ-2.1). Every node/rel table lives here, in
// one place, so the schema is diffable at a glance and the schema-explorer can
// read it as the single source of truth. Each later part appends its own tables
// under its heading rather than scattering `CREATE … TABLE` across repositories.
//
// All statements are idempotent (`IF NOT EXISTS`) so they run on every boot.
// The DB is authoritative (no rebuild-from-files), so schema changes are
// explicit migrations, not "recreate + re-index" (OQ-2.3).
//
// Every mutable row carries a `version` (INT64) for optimistic concurrency
// (OQ-2.3), and — once artifacts land in Parts 3–6 — a `project_id` (STRING)
// for tenant scoping (OQ-2.2).
export const GRAPH_SCHEMA: readonly string[] = [
  // --- Projects (Part 2) ---
  `CREATE NODE TABLE IF NOT EXISTS Project(
     id STRING,
     name STRING,
     version INT64 DEFAULT 0,
     created_at STRING,
     PRIMARY KEY(id)
   )`,
];
