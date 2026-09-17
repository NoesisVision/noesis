// Central declarative graph schema (OQ-2.1). Every node/rel table lives here, in
// one place, so the schema is diffable at a glance and the schema-explorer can
// read it as the single source of truth. Each later part appends its own tables
// under its heading rather than scattering `CREATE … TABLE` across repositories.
//
// The graph is an in-memory cache over the files in `.noesis/` (decision 68):
// the indexer rebuilds every table from the files at boot and whenever the
// watcher sees a change, and nothing writes a table any other way. So there
// are no migrations — a schema change here is picked up by the next boot —
// and the statements only need to be valid on an empty database. `IF NOT
// EXISTS` is kept so ensureSchema stays idempotent within a process.
//
// Every node table follows one pattern: the id, the denormalised columns a
// list or a search reads without parsing, and the whole entity as JSON in
// `json`. `change` is set on the kinds that live under
// `.noesis/graph/changes/<change>/` and empty on the wiki. There is no file
// time: a `git checkout` rewrites it, and nothing read it (decision 76).
//
// The server runs locally against one checkout, so there is no tenant scoping
// and no `version` column: the single writer needs no optimistic concurrency
// (decision 65, superseding OQ-2.2/2.3's clauses).
export const GRAPH_SCHEMA: readonly string[] = [
  // --- Design documents (design-doc phase 2) ---
  //
  // The projection of `.noesis/graph/changes/<change>/design-docs/`, one
  // node per document. `document` is the whole portable specification
  // (`DesignDocument`) as JSON; `name`, `status` and `date` are denormalised
  // copies of document fields so listing does not parse every document.
  `CREATE NODE TABLE IF NOT EXISTS DesignDoc(
     id STRING,
     change STRING,
     name STRING,
     status STRING,
     date STRING,
     document STRING,
     PRIMARY KEY(id)
   )`,

  // --- Imported sources (`changes/<change>/conversations/`, `documents/`) ---
  `CREATE NODE TABLE IF NOT EXISTS Conversation(
     id STRING,
     change STRING,
     title STRING,
     time STRING,
     json STRING,
     PRIMARY KEY(id)
   )`,
  `CREATE NODE TABLE IF NOT EXISTS Document(
     id STRING,
     change STRING,
     title STRING,
     date STRING,
     json STRING,
     PRIMARY KEY(id)
   )`,

  // --- The implemented model (`graph/system-model/`), one node per scanned unit ---
  `CREATE NODE TABLE IF NOT EXISTS SystemModel(
     id STRING,
     name STRING,
     scanned_at STRING,
     json STRING,
     PRIMARY KEY(id)
   )`,

  // --- The wiki (`graph/wiki/topics/`, `graph/wiki/decisions/`) ---
  `CREATE NODE TABLE IF NOT EXISTS Topic(
     id STRING,
     parent_id STRING,
     title STRING,
     short_summary STRING,
     json STRING,
     PRIMARY KEY(id)
   )`,
  `CREATE NODE TABLE IF NOT EXISTS Decision(
     id STRING,
     topic_id STRING,
     title STRING,
     status STRING,
     json STRING,
     PRIMARY KEY(id)
   )`,
];

/** The node tables the DDL declares, in declaration order. */
export function nodeTableNames(): string[] {
  const names: string[] = [];
  for (const ddl of GRAPH_SCHEMA) {
    const match = /CREATE NODE TABLE IF NOT EXISTS\s+(\w+)/i.exec(ddl);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}
