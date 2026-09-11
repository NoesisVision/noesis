// Central declarative graph schema (OQ-2.1). Every node/rel table lives here, in
// one place, so the schema is diffable at a glance and the schema-explorer can
// read it as the single source of truth. Each later part appends its own tables
// under its heading rather than scattering `CREATE … TABLE` across repositories.
//
// All statements are idempotent (`IF NOT EXISTS`) so they run on every boot.
// The files under `.noesis/` are authoritative and the graph is a cache over
// them (decision 68): nothing here is migrated, it is rebuilt from the files.
//
// The server runs locally against one checkout, so there is no tenant scoping
// and no `version` column: the single writer needs no optimistic concurrency
// (decision 65, superseding OQ-2.2/2.3's clauses).
export const GRAPH_SCHEMA: readonly string[] = [
  // --- Design documents (design-doc phase 2) ---
  //
  // The projection of `.noesis/changes/<change>/design-docs/*.json`, to be
  // fed by the indexer; the design-docs repository itself reads and writes
  // the files only. `document` is the whole portable specification
  // (`DesignDocument`) as JSON; `name`, `status` and `date` are denormalised
  // copies of document fields so listing does not parse every document.
  `CREATE NODE TABLE IF NOT EXISTS DesignDoc(
     id STRING,
     name STRING,
     status STRING,
     date STRING,
     document STRING,
     created_at STRING,
     updated_at STRING,
     PRIMARY KEY(id)
   )`,
];
