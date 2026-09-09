// Central declarative graph schema (OQ-2.1). Every node/rel table lives here, in
// one place, so the schema is diffable at a glance and the schema-explorer can
// read it as the single source of truth. Each later part appends its own tables
// under its heading rather than scattering `CREATE … TABLE` across repositories.
//
// All statements are idempotent (`IF NOT EXISTS`) so they run on every boot.
// The DB is authoritative (no rebuild-from-files), so schema changes are
// explicit migrations, not "recreate + re-index" (OQ-2.3).
//
// The server runs locally against one checkout, so there is no tenant scoping
// and no `version` column: entities are top-level and the single writer needs
// no optimistic concurrency (decision 65, superseding OQ-2.2/2.3's clauses).
export const GRAPH_SCHEMA: readonly string[] = [
  // --- Design documents (design-doc phase 2) ---
  //
  // `document` is the whole portable specification (`DesignDocument`) as JSON,
  // validated at the write boundary (schema parse + integrity check) so a
  // stored document always parses back. `name`, `status` and `date` are
  // denormalised copies of document fields so listing does not parse every
  // document.
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

  // --- Inbox (inbox.md) ---
  //
  // One node per signal; repeats fold into it (count/last_seen_at) keyed by
  // the sender-provided dedup_key — never guessed from content. Optional
  // STRING columns use '' for "absent" so equality filters stay plain (the
  // repository maps '' to null at its edge). `occurrences` is a JSON array of
  // the most recent arrival timestamps, capped in the repository.
  `CREATE NODE TABLE IF NOT EXISTS InboxItem(
     id STRING,
     kind STRING,
     title STRING,
     origin STRING,
     body STRING,
     dedup_key STRING,
     event_start STRING,
     snoozed_until STRING,
     state STRING,
     count INT64 DEFAULT 1,
     occurrences STRING,
     outcome_at STRING,
     outcome_reason STRING,
     last_seen_at STRING,
     created_at STRING,
     PRIMARY KEY(id)
   )`,
];
