// No migrations: the indexer rebuilds every table from the files at boot, so
// the statements only need to be valid on an empty database (decision D1).
// No file-time column: a `git checkout` rewrites it (decision D2). No `version`
// column: the single writer needs no optimistic concurrency (decision D1).
export const GRAPH_SCHEMA: readonly string[] = [
  // `document`, not `json`, holds the whole `DesignDocument`.
  `CREATE NODE TABLE IF NOT EXISTS DesignDoc(
     id STRING,
     change STRING,
     name STRING,
     status STRING,
     date STRING,
     document STRING,
     PRIMARY KEY(id)
   )`,

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

  `CREATE NODE TABLE IF NOT EXISTS SystemModel(
     id STRING,
     name STRING,
     scanned_at STRING,
     json STRING,
     PRIMARY KEY(id)
   )`,
];

export function nodeTableNames(): string[] {
  const names: string[] = [];
  for (const ddl of GRAPH_SCHEMA) {
    const match = /CREATE NODE TABLE IF NOT EXISTS\s+(\w+)/i.exec(ddl);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}
